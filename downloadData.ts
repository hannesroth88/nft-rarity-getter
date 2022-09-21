import axios from "axios"
import dotenv from "dotenv"
dotenv.config()

import Nedb from "nedb"
import _, { map } from "underscore"
const fs = require("fs")

const MAX_SUPPLY_TOKEN = 5000
const PROJECT_NAME = "stoics"

//load config
const config = JSON.parse(fs.readFileSync("config.json")) as Config
// get project
const project = config.projects.find((project) => project.name == PROJECT_NAME) as Project

start()

async function start() {
  // fetch nedb entries
  const neDbConnection = new Nedb({
    filename: "./db/" + project.name + ".db",
    autoload: true
  })

  // get Data from Ipfs/Server
  await downloadData(neDbConnection)
}

//replace forbidden characters for JSON
function escapeSpecialChars(string: string) {
  return string
    .replace(/\\n/g, "_")
    .replace(/\\'/g, "_")
    .replace(/\\"/g, "_")
    .replace(/\\&/g, "_")
    .replace(/\\r/g, "_")
    .replace(/\\t/g, "_")
    .replace(/\\b/g, "_")
    .replace(/\\f/g, "_")
    .replace(/\s/g, "_")
}

const delay = (ms = 10) => new Promise((r) => setTimeout(r, ms))

const getIpfsTokens = async function (neDbConnection: Nedb, tokensDb: Token[], tokensToQuery: number[], metaDataUrl: string) {
  for (let i = 0; i < tokensToQuery.length; i++) {
    if (!tokensDb.some((item) => item.tokenId === tokensToQuery[i])) {
      let url = ""
      if (project.urlVariant == 1) {
        url = metaDataUrl + "/" + tokensToQuery[i]
      } else if (project.urlVariant == 2) {
        url = metaDataUrl + "/" + tokensToQuery[i] + ".json"
      }
      console.log(url);
      
      const res = await axios.get(url)

      console.log("tokenId: " + tokensToQuery[i] + " not in Db, get data now,    DATE:" + new Date().toLocaleTimeString("de-DE") + "    url:" + url)
      await delay()
      try {
        // Write to DB
        let newToken: any = {}
        newToken["tokenId"] = tokensToQuery[i]
        if (project.traitJsonType == 1) {
          //@ts-ignore
          res.data.attributes.forEach((attr) => {
            let traitType = escapeSpecialChars(attr.trait_type)
            let traitTypeValue = escapeSpecialChars(attr.value)
            newToken[traitType] = traitTypeValue
          })
        } else if (project.traitJsonType == 2) {
          //@ts-ignore
          newToken = (newToken, res.data.attributes)
        }
        neDbConnection.insert(newToken, function (err, newDoc) {})
      } catch (error) {
        //@ts-ignore
        console.error(res.data)
        console.error(error)
      }
    }
  }
}


async function downloadData(neDbConnection: Nedb<any>) {
  console.log("Download Data");
  
  neDbConnection.find({}, async function (err: any, tokensDb: any[]) {
    if (err) return console.log(err)
    const tokenIdsDb = tokensDb.map((token: { tokenId: any }) => token.tokenId)
    let tokenIds: number[] = Array.from(
      {
        length: MAX_SUPPLY_TOKEN
      },
      (_, j) => j + 1
    )

    // filter out Ids which are already in DB
    const remainingIds = tokenIds.filter(function (el) {
      return tokenIdsDb.indexOf(el) < 0
    })
    console.log(remainingIds)

    if (project.isIpfs) {
      // if there are many id metadata to fetch use multiple gateways
      if (remainingIds.length >= config.ipfsGateways.length) {
        const sizePerBatch = Math.ceil(remainingIds.length / config.ipfsGateways.length) as number
        let tokenIdsSplit: any[] = [],
          size = sizePerBatch
        while (remainingIds.length > 0) {
          tokenIdsSplit.push(remainingIds.splice(0, size))
        }
        console.log(tokenIdsSplit)
        for (let i = 0; i < config.ipfsGateways.length; i++) {
          await getIpfsTokens(neDbConnection, tokensDb, tokenIdsSplit[i], config.ipfsGateways[i] + project.url)
        }
        // just use the first gateway
      } else {
        await getIpfsTokens(neDbConnection, tokensDb, remainingIds, config.ipfsGateways[0] + project)
      }
    } else {
      await getIpfsTokens(neDbConnection, tokensDb, remainingIds, project.url)
    }
  })
}
