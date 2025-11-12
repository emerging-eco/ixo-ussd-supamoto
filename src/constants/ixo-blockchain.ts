export enum CHAIN_NETWORK_TYPE {
  MAINNET = "mainnet",
  TESTNET = "testnet",
  DEVNET = "devnet",
  LOCAL = "local",
}

export const DefaultChainNetwork = (process.env.CHAIN_NETWORK ||
  "devnet") as CHAIN_NETWORK_TYPE;

export const BlocksyncUrls: { [network in CHAIN_NETWORK_TYPE]: string } = {
  [CHAIN_NETWORK_TYPE.MAINNET]: "https://blocksync-graphql.ixo.earth",
  [CHAIN_NETWORK_TYPE.TESTNET]: "https://testnet-blocksync-graphql.ixo.earth",
  [CHAIN_NETWORK_TYPE.DEVNET]: "https://devnet-blocksync-graphql.ixo.earth",
  [CHAIN_NETWORK_TYPE.LOCAL]: "http://localhost:8083",
};
export const BLOCKSYNC_URL = BlocksyncUrls[DefaultChainNetwork];

export const CHAIN_RPC = {
  [CHAIN_NETWORK_TYPE.MAINNET]: "https://impacthub.ixo.world/rpc/",
  [CHAIN_NETWORK_TYPE.TESTNET]: "https://testnet.ixo.earth/rpc/",
  [CHAIN_NETWORK_TYPE.DEVNET]: "https://devnet.ixo.earth/rpc/",
  [CHAIN_NETWORK_TYPE.LOCAL]: "http://localhost:26657",
};
export const CHAIN_RPC_URL = CHAIN_RPC[DefaultChainNetwork];

export const CHAIN_IDS: { [network in CHAIN_NETWORK_TYPE]: string } = {
  [CHAIN_NETWORK_TYPE.MAINNET]: "ixo-5",
  [CHAIN_NETWORK_TYPE.TESTNET]: "pandora-8",
  [CHAIN_NETWORK_TYPE.DEVNET]: "devnet-1",
  [CHAIN_NETWORK_TYPE.LOCAL]: "devnet-1",
};
export const CHAIN_ID = CHAIN_IDS[DefaultChainNetwork];
