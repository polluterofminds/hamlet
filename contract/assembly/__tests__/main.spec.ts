import { get_contract_owner, init, mint_to, get_token_uri, get_token_owner, grant_access, check_access, revoke_access, transfer_from, get_subscription_price, change_subscription_price, get_balance, update_post, get_post_hash_by_title, get_post_visibility, get_block_index } from '../index';
import { VMContext, u128 } from "near-sdk-as";
const ALICE = 'alice'
const BOB = 'bob'
const CAROL = 'carol'
const METADATA_URI = "ipfs://QmPhruW8YK6PpvchQokowg1X5kH14Z1xSZFfto44Gvx2gS"
const INITIAL_PRICE = 100
const NEW_PRICE = 150

describe("Initializing Contract", () => {
    it("should successfully initialize the contract", () => {
        //  We do this because each user will be deploying their own contract and this represents a user logged in deploying
        VMContext.setPredecessor_account_id(ALICE)
        init(INITIAL_PRICE)
        const owner = get_contract_owner()
        expect(owner).toBe(ALICE)
    })
    it("should not allow init to be called after contract is deployed", () => {
        //  We do this because each user will be deploying their own contract and this represents a user logged in deploying
        VMContext.setPredecessor_account_id(ALICE)
        init(INITIAL_PRICE)
        expect(() => {
            VMContext.setPredecessor_account_id(BOB)
            init(INITIAL_PRICE)
        }).toThrow()
    })
})

describe("Minting", () => {
    it("should get a null owner", () => {
        const owner = get_contract_owner()
        expect(owner).toBe(null)
    });
    it("should get correct owner", () => {
        VMContext.setPredecessor_account_id(ALICE)
        init(INITIAL_PRICE)
        const owner = get_contract_owner()
        expect(owner).toBe(ALICE)
    });
    it("should mint a new token to non-contract owner", () => {
        VMContext.setPredecessor_account_id(ALICE)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        const tokenId = mint_to(ALICE, METADATA_URI)
        expect(tokenId).toBe(1);
    });
    it("should get contract balance", () => {
        VMContext.setPredecessor_account_id(ALICE)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        mint_to(BOB, METADATA_URI)
        const balance = get_balance()
        expect(balance).toBeGreaterThan(u128.from('0'))
    });
    it("should get correct token owner", () => {
        VMContext.setPredecessor_account_id(ALICE)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        const tokenId = mint_to(ALICE, METADATA_URI)
        const owner = get_token_owner(tokenId)
        expect(owner).toBe(ALICE)
    })
    it("should get the tokenURI", () => {
        VMContext.setPredecessor_account_id(ALICE)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        const tokenId = mint_to(ALICE, METADATA_URI)
        const metadataUri = get_token_uri(tokenId)
        expect(metadataUri).toBe(METADATA_URI)
    })
})

describe("Access", () => {
    it("should successfuly grant token acces to another user", () => {
        VMContext.setPredecessor_account_id(ALICE)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        mint_to(ALICE, METADATA_URI)
        grant_access(BOB)
        VMContext.setPredecessor_account_id(BOB)
        //  This is Bob checking is Alice has given him access to the token
        expect(check_access(ALICE)).toBe(true)
    });
    it("should revoke access for a user", () => {
        VMContext.setPredecessor_account_id(ALICE)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        mint_to(ALICE, METADATA_URI)
        grant_access(BOB)
        revoke_access(BOB)
        VMContext.setPredecessor_account_id(BOB)
        //  This is Bob checking is Alice has given him access to the token
        expect(check_access(ALICE)).toBe(false)
    })
});

describe("Transfers", () => {
    it("should transfer token owner by Alice to Bob", () => {
        VMContext.setPredecessor_account_id(ALICE)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        const aliceToken = mint_to(ALICE, METADATA_URI)

        expect(get_token_owner(aliceToken)).toBe(ALICE)
        expect(get_token_owner(aliceToken)).not.toBe(BOB)

        VMContext.setPredecessor_account_id(ALICE)
        transfer_from(ALICE, BOB, aliceToken)

        expect(get_token_owner(aliceToken)).toBe(BOB)
        expect(get_token_owner(aliceToken)).not.toBe(ALICE)
    })
    it("allows escrowed tokens to be transferred by escrowee", () => {
        // Alice grants access to Bob
        VMContext.setPredecessor_account_id(ALICE)
        grant_access(BOB)

        // Alice has a token
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        init(INITIAL_PRICE)
        const aliceToken = mint_to(ALICE, METADATA_URI)
        expect(get_token_owner(aliceToken)).toBe(ALICE)
        expect(get_token_owner(aliceToken)).not.toBe(BOB)

        // BOB transfers to himself
        VMContext.setPredecessor_account_id(BOB)
        transfer_from(ALICE, BOB, aliceToken)

        expect(get_token_owner(aliceToken)).toBe(BOB)
        expect(get_token_owner(aliceToken)).not.toBe(ALICE)
    })
    it("should show the contract owner has a balance", () => {
        VMContext.setPredecessor_account_id(ALICE)
        init(INITIAL_PRICE)
        grant_access(BOB)
        VMContext.setPredecessor_account_id(BOB)
        VMContext.setAttached_deposit(u128.from('10000000000000000000000'));
        mint_to(BOB, METADATA_URI)
    })
});

describe("Subscription price", () => {
    it("should get the current subscription price", () => {
        VMContext.setPredecessor_account_id(ALICE)
        init(INITIAL_PRICE)
        const price = get_subscription_price()
        expect(price).toBe(INITIAL_PRICE)
    })
    it("should allow contract owner to set a new subscription price", () => {
        VMContext.setPredecessor_account_id(ALICE)
        init(INITIAL_PRICE)
        VMContext.setPredecessor_account_id(ALICE)
        change_subscription_price(NEW_PRICE)
        expect(get_subscription_price()).toBe(NEW_PRICE)
    })
    it("should not allow another user to change the price", () => {
        VMContext.setPredecessor_account_id(ALICE)
        init(INITIAL_PRICE)
        VMContext.setPredecessor_account_id(BOB)
        expect(() => {
            change_subscription_price(NEW_PRICE)
        }).toThrow()
    })

    describe("Posts", () => {
        it("should create a new post", () => {
            const TITLE = "My New Post"
            const HASH = "FAKE_HASH"
            VMContext.setPredecessor_account_id(ALICE)
            init(INITIAL_PRICE)
            update_post(TITLE, HASH, "PUBLISHED_FREE")
        })

        it("should create and fetch a post", () => {
            const TITLE = "My New Post"
            const HASH = "FAKE_HASH"
            VMContext.setPredecessor_account_id(ALICE)
            init(INITIAL_PRICE)
            update_post(TITLE, HASH, "PUBLISHED_FREE")
            const hash = get_post_hash_by_title(TITLE)
            expect(hash).toBe(HASH)
        })

        it("should overwrite a post based on title and fetch a post", () => {
            const TITLE = "My New Post"
            const HASH = "FAKE_HASH"
            const HASH_TWO = "HASH_TWO"
            VMContext.setPredecessor_account_id(ALICE)
            init(INITIAL_PRICE)
            update_post(TITLE, HASH, "PUBLISHED_FREE")
            const hash = get_post_hash_by_title(TITLE)
            expect(hash).toBe(HASH)
            update_post(TITLE, HASH_TWO, "PUBLISHED_FREE")
            const hashTwo = get_post_hash_by_title(TITLE)
            expect(hashTwo).toBe(HASH_TWO)
        })

        it("should create a draft post", () => {
            const TITLE = "My New Post"
            const HASH = "FAKE_HASH"           
            VMContext.setPredecessor_account_id(ALICE)
            init(INITIAL_PRICE)
            update_post(TITLE, HASH, "DRAFT")
            const hash = get_post_hash_by_title(TITLE)
            expect(hash).toBe(HASH)
            const visibility = get_post_visibility(TITLE)
            expect(visibility).toBe("DRAFT")
        })
        it("should not allow reader to access draft post", () => {
            const TITLE = "My New Post"
            const HASH = "FAKE_HASH"           
            VMContext.setPredecessor_account_id(ALICE)
            init(INITIAL_PRICE)
            update_post(TITLE, HASH, "DRAFT")
            VMContext.setPredecessor_account_id(BOB)
            expect(() => {
                get_post_hash_by_title("My New Post")            
            }).toThrow()
        })
    });

    describe("Block index", () => {
        it("should return the current block index", () => {
            VMContext.setPredecessor_account_id(ALICE)
            init(INITIAL_PRICE)
            const index = get_block_index();
            expect(index).toBe(1);
        })
    })
})
