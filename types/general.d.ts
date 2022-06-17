interface Config {
  projects: Project[]
  ipfsGateways: string[]
}

interface Project {
  name: string
  url: string
  contractAddress:string
  isIpfs: boolean
  urlVariant: number
  traitJsonType: number
  traitWeights: [{ key: string; weight: number }, { key: string; weight: number }]
}

interface Token {
    tokenId : number
}