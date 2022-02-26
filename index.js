import axios from "axios"
import dotenv from "dotenv"
dotenv.config()

//https://github.com/louischatriot/nedb
import Nedb from "nedb"
import _, { map } from "underscore"

/*
#########
Classes
#########
*/

class Project {
  constructor(name, url, isIpfs, urlVariant, traitJsonType, traitWeights) {
    this.name = name
    this.url = url
    // hosted on IPFS?
    this.isIpfs = isIpfs
    // 1=ipfs/QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz/tokenId 2=ipfs/QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz/tokenId.json
    this.urlVariant = urlVariant
    this.traitJsonType = traitJsonType
    this.traitWeights = traitWeights
  }
}

/*
#########
Initialize
#########
*/

const maxSupplyToken = 9999
// const project = new Project("metaheros","QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz", true, 1, 1,[{key:"Identity", weight:2},{key:"Origin", weight:1.5}])
// const project = new Project("metaheros", "QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz", true, 1, 1, [
//   { key: "Identity", weight: 2 },
//   { key: "Origin", weight: 1.5 }
// ])
// const project = new Project("shibaShelterNFT", "QmVbQmMvLCkUZxRoefJev8oTbVfwRjiEEP1s754Je3wQ43", true, 2, 1, [{ key: "Fur", weight: 200 }])
const project = new Project("starCatchers", "QmYACuxce6MCfppZRBdbY9D6etwX9m63tJJVmx3FGa7ND6", true, 1, 1, [{key:"Background_Bling ", weight:5}])
// const project = new Project("2112", "https://mint.2112.run/tokens721", false, 2, 2, [
//   { key: "Special", weight: 20 },
//   { key: "Talent", weight: 10 }
// ])

/*
#########
Business Logic
#########
*/

start()

/*
#########
Functions
#########
*/

async function start() {
  // fetch nedb entries
  var neDbConnection = new Nedb({
    filename: "./db/" + project.name + ".db",
    autoload: true
  })

  // get Data from Ipfs/Server
  downloadData(neDbConnection)

  // load Db again
  calculateRarity(neDbConnection)
}

String.prototype.escapeSpecialChars = function () {
  return this.replace(/\\n/g, "_")
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
const getIpfsTokens = async function (neDbConnection, tokensDb, tokensToQuery, metaDataUrl, urlVariant) {
  for (let i = 0; i < tokensToQuery.length; i++) {
    if (!tokensDb.some((item) => item.tokenId === tokensToQuery[i])) {
      var url
      if (urlVariant == 1) {
        url = metaDataUrl + "/" + tokensToQuery[i]
      } else if (urlVariant == 2) {
        url = metaDataUrl + "/" + tokensToQuery[i] + ".json"
      }
      const res = await axios.get(url).catch((error) => {
        console.log(error)
      })

      console.log("tokenId: " + tokensToQuery[i] + " not in Db, get data now,    DATE:" + new Date().toLocaleTimeString("de-DE") + "    url:" + url)
      await delay()

      try {
        // Write to DB
        var newToken = {}
        newToken["tokenId"] = tokensToQuery[i]
        if (project.traitJsonType == 1) {
          res.data.attributes.forEach((attr) => {
            var traitType = attr.trait_type.escapeSpecialChars()
            var traitTypeValue = attr.value.escapeSpecialChars()
            newToken[traitType] = traitTypeValue
          })
        } else if (project.traitJsonType == 2) {
          newToken = Object.assign(newToken, res.data.attributes)
        }
        neDbConnection.insert(newToken, function (err, newDoc) {})
      } catch (error) {
        console.error(res.data)
        console.error(error)
      }
    } else {
      // console.log("tokenId: " + tokensToQuery[i] + " already in Db")
    }
  }
}

function calculateRarity(neDbConnection) {
  neDbConnection.find({}, async function (err, tokensDb) {
    if (err) return console.log(err)

    var uniqueTraitTypes = findUniqueTraits(tokensDb)
    console.log("uniqueTraitTypes: " + uniqueTraitTypes)

    var rarityTraits = calculateTraits(uniqueTraitTypes, tokensDb)
    console.log("rarityTraits: " + rarityTraits)

    var tokenScores = appendTraitScoreToTokens(tokensDb, rarityTraits)
    const valuableTokenScores = tokenScores.slice(0, 100)
    const tokenScoresTop10 = valuableTokenScores.slice(0, 10)
    console.log("tokenScoresTop10: " + JSON.stringify(tokenScoresTop10, null, 2))

    var valuableTokenIds = valuableTokenScores.map((token) => {
      return token.tokenId
    })
    console.log("VALUABLE TokenIDs: [" + valuableTokenIds + "]")
  })
}

function downloadData(neDbConnection) {
  neDbConnection.find({}, async function (err, tokensDb) {
    if (err) return console.log(err)
    const tokenIdsDb = tokensDb.map((token) => token.tokenId)
    // console.log(tokensDb)
    var tokenIds = Array.from(
      {
        length: maxSupplyToken
      },
      (_, j) => j + 1
    )

    // filter out Ids which are already in DB
    const remainingIds = tokenIds.filter(function (el) {
      return tokenIdsDb.indexOf(el) < 0
    })
    console.log(remainingIds)

    if (project.isIpfs) {
      const ipfsGateways = [
        "https://gateway.pinata.cloud/ipfs/",
        "https://ipfs.io/ipfs/",
        "https://cf-ipfs.com/ipfs/",
        "https://gateway.ipfs.io/ipfs/",
        "https://ipfs.adatools.io/ipfs/",
        "https://dweb.link/ipfs/",
        "https://hardbin.com/ipfs/"
      ]
      if (remainingIds.length >= ipfsGateways.length) {
        const sizePerBatch = Math.ceil(remainingIds.length / ipfsGateways.length)
        var tokenIdsSplit = [],
          size = sizePerBatch
        while (remainingIds.length > 0) {
          tokenIdsSplit.push(remainingIds.splice(0, size))
        }
        console.log(tokenIdsSplit)
        for (let i = 0; i < ipfsGateways.length; i++) {
          getIpfsTokens(neDbConnection, tokensDb, tokenIdsSplit[i], ipfsGateways + project.url, project.urlVariant)
        }
      } else {
        // just use one gateway
        getIpfsTokens(neDbConnection, tokensDb, remainingIds, ipfsGateways[0] + project.url, project.urlVariant)
      }
    } else {
      await getIpfsTokens(neDbConnection, tokensDb, remainingIds, project.url, project.urlVariant)
    }
  })
}

function appendTraitScoreToTokens(tokensDb, rarityTraits) {
  var tokenScores = tokensDb.map((token) => {
    let sum = 0
    for (const key in token) {
      var scorePerTrait
      // di for every key except for tokenId and _id
      if (key != "tokenId" && key != "_id") {
        //weights of certain traitTypes
        const traitIsInArray = project.traitWeights.filter((trait) => trait.key == key)
        if (traitIsInArray.length > 0) {
          scorePerTrait = (100 - rarityTraits[key][token[key]]) * traitIsInArray[0].weight
        } else {
          scorePerTrait = 100 - rarityTraits[key][token[key]]
        }
        sum = sum + scorePerTrait
      }
    }
    // console.log(`${token['tokenId']} : ${Math.round(sum)}`)
    return {
      tokenId: token.tokenId,
      sum: Math.round(sum)
    }
  })
  return tokenScores.sort((a, b) => parseFloat(b.sum) - parseFloat(a.sum))
}

function findUniqueTraits(tokensDb) {
  var uniqueTraitTypes = []
  tokensDb.forEach((token) => {
    for (var traitType in token) {
      //only add if not there yet and not ids
      if (traitType != "tokenId" && traitType != "_id" && uniqueTraitTypes.indexOf(traitType) === -1) {
        uniqueTraitTypes.push(traitType)
      }
    }
  })
  return uniqueTraitTypes
}

function calculateTraits(uniqueTraitTypes, tokensDb) {
  var rarityTraits = []
  uniqueTraitTypes.forEach((traitType) => {
    var counts = _.countBy(tokensDb, traitType)
    console.log("### TraitType: " + traitType + "###")
    // calculate Rarity in Percent
    var rarityPerTraitType = []
    for (var key in counts) {
      if (counts.hasOwnProperty(key)) {
        var rarityPercent = (counts[key] / tokensDb.length) * 100
        // console.log(rarityPercent)
        if (rarityPercent < 0.5) {
          console.log(`${key}: ${rarityPercent} ( ${counts[key]} / ${tokensDb.length})`)
        }
        rarityPerTraitType[key] = Math.round((rarityPercent + Number.EPSILON) * 100) / 100 // round 2 decimals

        // rarityPerTraitType[key] = rarityPercent
      }
    }
    // countTraits[trait_type] = counts
    rarityTraits[traitType] = rarityPerTraitType
  })
  return rarityTraits
}
