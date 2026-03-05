// SPDX-License-Identifier: MIT
// ✨ Sage Achievements - BitSage Discord Rewards NFT Contract
// Soulbound achievement NFTs for Discord community milestones
// Built by BitSage Network - Fully independent, Starknet-native

use starknet::ContractAddress;

#[derive(Drop, Copy, Serde, starknet::Store)]
pub struct AchievementMetadata {
    pub achievement_type: u16,      // Type of achievement (101-999)
    pub discord_user_id: felt252,   // Discord user ID (as felt)
    pub guild_id: felt252,          // Discord guild/server ID
    pub earned_at: u64,             // Unix timestamp
    pub tier: u8,                   // Tier: 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
    pub season: u16,                // Season/year (e.g., 2026)
}

#[starknet::interface]
pub trait ISageAchievements<TContractState> {
    // Minting functions
    fn mint_achievement(
        ref self: TContractState,
        to: ContractAddress,
        token_id: u256,
        metadata: AchievementMetadata,
        metadata_uri: ByteArray
    );

    fn batch_mint(
        ref self: TContractState,
        recipients: Array<ContractAddress>,
        token_ids: Array<u256>,
        metadata_list: Array<AchievementMetadata>,
        metadata_uri: ByteArray
    );

    // Query functions
    fn get_achievement_metadata(self: @TContractState, token_id: u256) -> AchievementMetadata;
    fn get_user_achievements(self: @TContractState, discord_user_id: felt252) -> Array<u256>;
    fn get_achievement_count_by_type(self: @TContractState, achievement_type: u16) -> u256;
    fn has_achievement(
        self: @TContractState,
        discord_user_id: felt252,
        achievement_type: u16
    ) -> bool;

    // Access control
    fn set_minter(ref self: TContractState, minter: ContractAddress);
    fn set_base_uri(ref self: TContractState, base_uri: ByteArray);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);

    // Upgradeable
    fn upgrade(ref self: TContractState, new_class_hash: starknet::ClassHash);

    // Stats
    fn get_total_achievements(self: @TContractState) -> u256;
    fn get_unique_recipients(self: @TContractState) -> u256;
}

#[starknet::contract]
mod SageAchievements {
    use super::{ISageAchievements, AchievementMetadata};
    use starknet::{ContractAddress, ClassHash, get_caller_address, syscalls::replace_class_syscall};
    use starknet::storage::{
        Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess,
        StoragePointerWriteAccess
    };
    use core::num::traits::Zero;

    #[storage]
    struct Storage {
        // Contract metadata
        name: ByteArray,
        symbol: ByteArray,
        base_uri: ByteArray,

        // Access control
        owner: ContractAddress,
        minter: ContractAddress,
        paused: bool,

        // ERC721-like storage
        owners: Map<u256, ContractAddress>,              // token_id => owner
        balances: Map<ContractAddress, u256>,            // owner => balance
        token_approvals: Map<u256, ContractAddress>,     // Disabled for soulbound
        operator_approvals: Map<(ContractAddress, ContractAddress), bool>, // Disabled

        // Achievement-specific storage
        achievement_metadata: Map<u256, AchievementMetadata>,
        token_uris: Map<u256, ByteArray>,

        // Indexing: discord_user_id => array of token_ids
        user_achievements: Map<(felt252, u256), u256>,   // (discord_id, index) => token_id
        user_achievement_count: Map<felt252, u256>,      // discord_id => count

        // Achievement type tracking
        achievement_type_count: Map<u16, u256>,          // achievement_type => count

        // Stats
        total_minted: u256,
        unique_recipients: u256,
        recipient_exists: Map<ContractAddress, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        AchievementMinted: AchievementMinted,
        MinterChanged: MinterChanged,
        Paused: Paused,
        Unpaused: Unpaused,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key]
        from: ContractAddress,
        #[key]
        to: ContractAddress,
        #[key]
        token_id: u256
    }

    #[derive(Drop, starknet::Event)]
    struct AchievementMinted {
        #[key]
        to: ContractAddress,
        #[key]
        discord_user_id: felt252,
        token_id: u256,
        achievement_type: u16,
        tier: u8
    }

    #[derive(Drop, starknet::Event)]
    struct MinterChanged {
        old_minter: ContractAddress,
        new_minter: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    struct Paused {
        by: ContractAddress
    }

    #[derive(Drop, starknet::Event)]
    struct Unpaused {
        by: ContractAddress
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        owner: ContractAddress,
        minter: ContractAddress,
        name: ByteArray,
        symbol: ByteArray,
        base_uri: ByteArray
    ) {
        self.owner.write(owner);
        self.minter.write(minter);
        self.name.write(name);
        self.symbol.write(symbol);
        self.base_uri.write(base_uri);
        self.paused.write(false);
        self.total_minted.write(0);
        self.unique_recipients.write(0);
    }

    // ============================================
    // External Functions
    // ============================================

    #[abi(embed_v0)]
    impl SageAchievementsImpl of ISageAchievements<ContractState> {
        fn mint_achievement(
            ref self: ContractState,
            to: ContractAddress,
            token_id: u256,
            metadata: AchievementMetadata,
            metadata_uri: ByteArray
        ) {
            self._assert_only_minter();
            self._assert_not_paused();
            assert(to.is_non_zero(), 'Invalid recipient');
            assert(self.owners.read(token_id).is_zero(), 'Token already minted');

            // Mint the NFT
            self.owners.write(token_id, to);
            self.balances.write(to, self.balances.read(to) + 1);

            // Store metadata
            self.achievement_metadata.write(token_id, metadata);
            self.token_uris.write(token_id, metadata_uri);

            // Index by discord user
            let user_count = self.user_achievement_count.read(metadata.discord_user_id);
            self.user_achievements.write((metadata.discord_user_id, user_count), token_id);
            self.user_achievement_count.write(metadata.discord_user_id, user_count + 1);

            // Track achievement type count
            let type_count = self.achievement_type_count.read(metadata.achievement_type);
            self.achievement_type_count.write(metadata.achievement_type, type_count + 1);

            // Update stats
            self.total_minted.write(self.total_minted.read() + 1);
            if !self.recipient_exists.read(to) {
                self.recipient_exists.write(to, true);
                self.unique_recipients.write(self.unique_recipients.read() + 1);
            }

            // Emit events
            self.emit(Transfer { from: Zero::zero(), to, token_id });
            self.emit(
                AchievementMinted {
                    to,
                    discord_user_id: metadata.discord_user_id,
                    token_id,
                    achievement_type: metadata.achievement_type,
                    tier: metadata.tier
                }
            );
        }

        fn batch_mint(
            ref self: ContractState,
            recipients: Array<ContractAddress>,
            token_ids: Array<u256>,
            metadata_list: Array<AchievementMetadata>,
            metadata_uri: ByteArray
        ) {
            self._assert_only_minter();
            self._assert_not_paused();

            let len = recipients.len();
            assert(len == token_ids.len(), 'Array length mismatch');
            assert(len == metadata_list.len(), 'Metadata length mismatch');

            let mut i: u32 = 0;
            loop {
                if i >= len {
                    break;
                }

                self
                    .mint_achievement(
                        *recipients.at(i),
                        *token_ids.at(i),
                        *metadata_list.at(i),
                        metadata_uri.clone()
                    );

                i += 1;
            }
        }

        fn get_achievement_metadata(
            self: @ContractState,
            token_id: u256
        ) -> AchievementMetadata {
            assert(self.owners.read(token_id).is_non_zero(), 'Token does not exist');
            self.achievement_metadata.read(token_id)
        }

        fn get_user_achievements(
            self: @ContractState,
            discord_user_id: felt252
        ) -> Array<u256> {
            let count = self.user_achievement_count.read(discord_user_id);
            let mut achievements = ArrayTrait::new();
            let mut i: u256 = 0;

            loop {
                if i >= count {
                    break;
                }
                achievements.append(self.user_achievements.read((discord_user_id, i)));
                i += 1;
            };

            achievements
        }

        fn get_achievement_count_by_type(self: @ContractState, achievement_type: u16) -> u256 {
            self.achievement_type_count.read(achievement_type)
        }

        fn has_achievement(
            self: @ContractState,
            discord_user_id: felt252,
            achievement_type: u16
        ) -> bool {
            let count = self.user_achievement_count.read(discord_user_id);
            let mut i: u256 = 0;

            loop {
                if i >= count {
                    break false;
                }

                let token_id = self.user_achievements.read((discord_user_id, i));
                let metadata = self.achievement_metadata.read(token_id);

                if metadata.achievement_type == achievement_type {
                    break true;
                }

                i += 1;
            }
        }

        fn set_minter(ref self: ContractState, minter: ContractAddress) {
            self._assert_only_owner();
            let old_minter = self.minter.read();
            self.minter.write(minter);
            self.emit(MinterChanged { old_minter, new_minter: minter });
        }

        fn set_base_uri(ref self: ContractState, base_uri: ByteArray) {
            self._assert_only_owner();
            self.base_uri.write(base_uri);
        }

        fn pause(ref self: ContractState) {
            self._assert_only_owner();
            self.paused.write(true);
            self.emit(Paused { by: get_caller_address() });
        }

        fn unpause(ref self: ContractState) {
            self._assert_only_owner();
            self.paused.write(false);
            self.emit(Unpaused { by: get_caller_address() });
        }

        fn upgrade(ref self: ContractState, new_class_hash: ClassHash) {
            self._assert_only_owner();
            replace_class_syscall(new_class_hash).unwrap();
        }

        fn get_total_achievements(self: @ContractState) -> u256 {
            self.total_minted.read()
        }

        fn get_unique_recipients(self: @ContractState) -> u256 {
            self.unique_recipients.read()
        }
    }

    // ============================================
    // ERC721 View Functions (Read-only, no transfers!)
    // ============================================

    #[generate_trait]
    impl ERC721ViewImpl of ERC721ViewTrait {
        fn name(self: @ContractState) -> ByteArray {
            self.name.read()
        }

        fn symbol(self: @ContractState) -> ByteArray {
            self.symbol.read()
        }

        fn token_uri(self: @ContractState, token_id: u256) -> ByteArray {
            assert(self.owners.read(token_id).is_non_zero(), 'Token does not exist');
            let custom_uri = self.token_uris.read(token_id);
            if custom_uri.len() > 0 {
                custom_uri
            } else {
                // Fallback to base_uri + token_id
                let mut uri = self.base_uri.read();
                // Note: In production, would append token_id.toString()
                uri
            }
        }

        fn balance_of(self: @ContractState, owner: ContractAddress) -> u256 {
            assert(owner.is_non_zero(), 'Invalid owner');
            self.balances.read(owner)
        }

        fn owner_of(self: @ContractState, token_id: u256) -> ContractAddress {
            let owner = self.owners.read(token_id);
            assert(owner.is_non_zero(), 'Token does not exist');
            owner
        }
    }

    // ============================================
    // Internal Functions
    // ============================================

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _assert_only_owner(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner');
        }

        fn _assert_only_minter(self: @ContractState) {
            let caller = get_caller_address();
            assert(caller == self.minter.read(), 'Only minter');
        }

        fn _assert_not_paused(self: @ContractState) {
            assert(!self.paused.read(), 'Contract paused');
        }
    }

    // ============================================
    // SOULBOUND: Transfer functions are DISABLED
    // ============================================
    // These functions intentionally panic to prevent transfers

    #[generate_trait]
    impl SoulboundImpl of SoulboundTrait {
        fn transfer_from(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            token_id: u256
        ) {
            panic!("Sage Achievements are soulbound and cannot be transferred");
        }

        fn safe_transfer_from(
            ref self: ContractState,
            from: ContractAddress,
            to: ContractAddress,
            token_id: u256,
            data: Span<felt252>
        ) {
            panic!("Sage Achievements are soulbound and cannot be transferred");
        }

        fn approve(ref self: ContractState, to: ContractAddress, token_id: u256) {
            panic!("Sage Achievements are soulbound and cannot be approved");
        }

        fn set_approval_for_all(
            ref self: ContractState,
            operator: ContractAddress,
            approved: bool
        ) {
            panic!("Sage Achievements are soulbound and cannot have operators");
        }
    }
}
