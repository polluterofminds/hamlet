import { PersistentMap, storage, context, u128, env, ContractPromise, ContractPromiseBatch } from 'near-sdk-as'

/**************************/
/* DATA TYPES AND STORAGE */
/**************************/

type AccountId = string
type TokenId = u64
type MetadataUri = string
type SubscriptionPrice = u64
type PostTitle = string
type PostHash = string
type PostVisibility = string

// Note that MAX_SUPPLY is implemented here as a simple constant
// It is exported only to facilitate unit testing
export const MAX_SUPPLY = u64(10)
//  SUBSCRIPTION_PRICE is a var because it can be changed by the contract owner
//  It is exported for testing
//  @TODO - figure out the right currency-specific amount here
export var SUBSCRIPTION_PRICE = u64(100)

// The strings used to index variables in storage can be any string
// Let's set them to single characters to save storage space
const tokenToOwner = new PersistentMap<TokenId, AccountId>('a')
const tokenToMetadata = new PersistentMap<TokenId, MetadataUri>('b')
const postTitleToHash = new PersistentMap<PostTitle, PostHash>('c')
const postTitleToVisibility = new PersistentMap<PostTitle, PostVisibility>('d')

// Note that with this implementation, an account can only set one escrow at a
// time. You could make values an array of AccountIds if you need to, but this
// complicates the code and costs more in storage rent.
const escrowAccess = new PersistentMap<AccountId, AccountId>('e')

// This is a key in storage used to track the current minted supply
const TOTAL_SUPPLY = 'f'

/******************/
/* ERROR MESSAGES */
/******************/

// These are exported for convenient unit testing
export const ERROR_CONTRACT_ALREADY_INITIALIZED = 'Contract has already been initialized'
export const ERROR_NO_ESCROW_REGISTERED = 'Caller has no escrow registered'
export const ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION = 'Caller ID does not match expectation'
export const ERROR_OWNER_IS_NULL = 'Owner is null'
export const ERROR_MAXIMUM_TOKEN_LIMIT_REACHED = 'Maximum token limit reached'
export const ERROR_OWNER_ID_DOES_NOT_MATCH_EXPECTATION = 'Owner id does not match real token owner id'
export const ERROR_TOKEN_NOT_OWNED_BY_CALLER = 'Token is not owned by the caller. Please use transfer_from for this scenario'
export const ERROR_DEPOSIT_AMOUNT_INVALID = 'Deposit amount is less than the subscription price'
export const ERROR_INVALID_VISIBILITY_SETTING = 'Visibility setting is invalid'

export function init(subscription_price: u64 ): void {
  assert(storage.get<string>("init") == null, ERROR_CONTRACT_ALREADY_INITIALIZED);
  assert(storage.get<string>("contract_owner") == null, ERROR_CONTRACT_ALREADY_INITIALIZED)
  const predecessor = context.predecessor
  storage.set("contract_owner", predecessor)
  storage.set("init", "done");
  SUBSCRIPTION_PRICE = subscription_price
}

export function get_block_index() : u64 {
  return env.block_timestamp()
}

/******************/
/* CHANGE METHODS */
/******************/

// Grant access to the given `accountId` for all tokens the caller has
export function grant_access(escrow_account_id: string): void {
  escrowAccess.set(context.predecessor, escrow_account_id)
}

// Revoke access to the given `accountId` for all tokens the caller has
export function revoke_access(escrow_account_id: string): void {
  escrowAccess.delete(context.predecessor)
}

// Transfer the given `token_id` to the given `new_owner_id`. Account `new_owner_id` becomes the new owner.
// Requirements:
// * The caller of the function (`predecessor`) should have access to the token.
export function transfer_from(owner_id: string, new_owner_id: string, token_id: TokenId): void {
  const predecessor = context.predecessor

  // fetch token owner and escrow; assert access
  const owner = tokenToOwner.getSome(token_id)
  assert(owner == owner_id, ERROR_OWNER_ID_DOES_NOT_MATCH_EXPECTATION)
  const escrow = escrowAccess.get(owner)
  assert([owner, escrow].includes(predecessor), ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)

  // assign new owner to token
  tokenToOwner.set(token_id, new_owner_id)
}


// Transfer the given `token_id` to the given `new_owner_id`. Account `new_owner_id` becomes the new owner.
// Requirements:
// * The caller of the function (`predecessor`) should be the owner of the token. Callers who have
// escrow access should use transfer_from.
export function transfer(new_owner_id: string, token_id: TokenId): void {
  const predecessor = context.predecessor

  // fetch token owner and escrow; assert access
  const owner = tokenToOwner.getSome(token_id)
  assert(owner == predecessor || owner == null, ERROR_TOKEN_NOT_OWNED_BY_CALLER)

  // assign new owner to token
  tokenToOwner.set(token_id, new_owner_id)
}


/****************/
/* VIEW METHODS */
/****************/

//  Helpers
function validVisibility(visibility: PostVisibility): bool {
  if(visibility == "PUBLISHED_FREE" || visibility == "PUBLISHED_PAID" || visibility == "DRAFT" || visibility == "DELETED") {
    return true;
  }

  return false;
}

// Returns `true` or `false` based on caller of the function (`predecessor`) having access to account_id's tokens
export function check_access(account_id: string): boolean {
  const caller = context.predecessor

  // throw error if someone tries to check if they have escrow access to their own account;
  // not part of the spec, but an edge case that deserves thoughtful handling
  assert(caller != account_id, ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)

  // if we haven't set an escrow yet, then caller does not have access to account_id
  if (!escrowAccess.contains(account_id)) {
    return false
  }

  const escrow = escrowAccess.getSome(account_id)
  return escrow == caller
}

// Get an individual owner by given `tokenId`
export function get_token_owner(token_id: TokenId): string {
  return tokenToOwner.getSome(token_id)
}

/********************/
/* NON-SPEC METHODS */
/********************/

//  Returns the contract balance
//  Only accessible by the contract owner
export function get_balance(): u128 {
  const caller = context.predecessor
  const owner = storage.getSome<string>('contract_owner')
  assert(caller == owner, ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)
  return context.accountBalance;
}

//  Change the subscription price
export function change_subscription_price(new_price: u64): void {
  const predecessor = context.predecessor
  const contract_owner = storage.get<string>("contract_owner")

  assert(predecessor == contract_owner, ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)
  SUBSCRIPTION_PRICE = new_price
}

export function update_post(postTitle: PostTitle, postHash: PostHash, postVisibility: PostVisibility): void {
  const caller = context.predecessor
  const owner = storage.getSome<string>('contract_owner')
  assert(caller == owner, ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)
  assert(validVisibility(postVisibility) == true, ERROR_INVALID_VISIBILITY_SETTING)
  postTitleToHash.set(postTitle, postHash)  
  postTitleToVisibility.set(postTitle, postVisibility)
  //@TODO We should store the index file hash from IPFS here too
}

export function get_post_hash_by_title(postTitle: PostTitle) : PostHash {
  const visibility = postTitleToVisibility.getSome(postTitle)
  const owner = storage.getSome<string>('contract_owner')
  if(visibility == "DRAFT" || visibility == "DELETED") {
    assert(context.predecessor == owner, ERROR_CALLER_ID_DOES_NOT_MATCH_EXPECTATION)
    return postTitleToHash.getSome(postTitle)
  } 
  return postTitleToHash.getSome(postTitle)
}

export function get_post_visibility(postTitle: PostTitle) : PostVisibility {
  return postTitleToVisibility.getSome(postTitle)
}

//  Get the metadata URI for an asset based on the tokenID
export function get_token_uri(token_id: TokenId): MetadataUri {
  return tokenToMetadata.getSome(token_id)
}

export function get_contract_owner(): string | null {
  return storage.get<string>("contract_owner")
}

export function get_subscription_price(): SubscriptionPrice {
  return SUBSCRIPTION_PRICE
}

// Note that ANYONE can call this function! You probably would not want to
// implement a real NFT like this!
export function mint_to(owner_id: AccountId, metadata_uri: MetadataUri): u64 {
  assert(context.attachedDeposit >= u128.from('10000000000000000000000'), ERROR_DEPOSIT_AMOUNT_INVALID)
  // Fetch the next tokenId, using a simple indexing strategy that matches IDs
  // to current supply, defaulting the first token to ID=1
  //
  // * If your implementation allows deleting tokens, this strategy will not work!
  // * To verify uniqueness, you could make IDs hashes of the data that makes tokens
  //   special; see https://twitter.com/DennisonBertram/status/1264198473936764935
  const tokenId = storage.getPrimitive<u64>(TOTAL_SUPPLY, 1)

  // enforce token limits – not part of the spec but important!
  assert(tokenId <= MAX_SUPPLY, ERROR_MAXIMUM_TOKEN_LIMIT_REACHED)

  // assign ownership
  tokenToOwner.set(tokenId, owner_id)

  //  assign metadata to token
  tokenToMetadata.set(tokenId, metadata_uri)

  // increment and store the next tokenId
  storage.set<u64>(TOTAL_SUPPLY, tokenId + 1)

  const owner = storage.get<string>("contract_owner")
  assert(owner != null, ERROR_OWNER_ID_DOES_NOT_MATCH_EXPECTATION)
  ContractPromiseBatch.create(owner!).transfer(u128.from(context.attachedDeposit))

  // return the tokenId – while typical change methods cannot return data, this
  // is handy for unit tests
  return tokenId
}