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
  constructor(name, url, isIpfs, urlVariant, traitWeights) {
    this.name = name
    this.url = url
    this.urlVariant = urlVariant
    this.traitWeights = traitWeights
    this.isIpfs = isIpfs
  }
}

/*
#########
Initialize
#########
*/

const maxSupplyToken = 800
// const project = new Project("metaheros","QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz", true, 1,[{key:"Identity", weight:2},{key:"Origin", weight:1.5}])
const project = new Project("metaheros", "QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz", true, 1, [
  { key: "Identity", weight: 2 },
  { key: "Origin", weight: 1.5 }
])
// const project = new Project("shibaShelterNFT", "QmVbQmMvLCkUZxRoefJev8oTbVfwRjiEEP1s754Je3wQ43", true, 2, [{ key: "Fur", weight: 200 }])
// const project = new Project("shibaShelterNFT", "QmVbQmMvLCkUZxRoefJev8oTbVfwRjiEEP1s754Je3wQ43, true", 2)

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

  // Now we can query it the usual way
  neDbConnection.find({}, async function (err, tokensDb) {
    if (err) return console.log(err)
    const tokenIdsDb = tokensDb.map((token) => token.tokenId)
    // console.log(tokensDb)
    var tokenIds = Array.from({ length: maxSupplyToken }, (_, j) => j + 1)

    // filter out Ids which are already in DB
    const remainingIds = tokenIds.filter(function (el) {
      return tokenIdsDb.indexOf(el) < 0
    })
    console.log(remainingIds)

    if (project.isIpfs) {
      const differentGateways = 3
      const halfSize = Math.ceil(remainingIds.length / differentGateways)
      var tokenIdsSplit = [],
        size = halfSize
      while (remainingIds.length > 0) tokenIdsSplit.push(remainingIds.splice(0, size))
      console.log(tokenIdsSplit)
      console.log("https://gateway.pinata.cloud/ipfs/")

      await getIpfsTokens(neDbConnection, tokensDb, tokenIdsSplit[0], "https://gateway.pinata.cloud/ipfs/" + project.url, project.urlVariant)
      await getIpfsTokens(neDbConnection, tokensDb, tokenIdsSplit[1], "https://ipfs.io/ipfs/" + project.url, project.urlVariant)
      await getIpfsTokens(neDbConnection, tokensDb, tokenIdsSplit[2], "https://cf-ipfs.com/ipfs/" + project.url, project.urlVariant)
    } else {
      await getIpfsTokens(neDbConnection, tokensDb, tokenIds, project.url, project.urlVariant)
    }

    var uniqueTraitTypes = findUniqueTraits(tokensDb)
    console.log("uniqueTraitTypes: " + uniqueTraitTypes)

    var rarityTraits = calculateTraits(uniqueTraitTypes, tokensDb)
    console.log("rarityTraits: " + rarityTraits)

    var tokenScores = appendTraitScoreToTokens(tokensDb, rarityTraits)
    const tokenScoresTop10 = tokenScores.slice(0, 10)
    console.log("tokenScoresTop10: " + JSON.stringify(tokenScoresTop10, null, 2))

    var tokenIdArray = tokenScores.map((token) => {
      return token.tokenId
    })
    console.log("VALUABLE TokenIDs: [" + tokenIdArray + "]")
  })
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
      console.log(
        "tokenId: " + tokensToQuery[i] + " not in Db, get data now,    DATE:" + new Date().toLocaleTimeString("de-DE") + "    url:" + metaDataUrl
      )
      await delay()
      var url
      if (urlVariant == 1) {
        url = metaDataUrl + "/" + tokensToQuery[i]
      } else if (urlVariant == 2) {
        url = metaDataUrl + "/" + tokensToQuery[i] + ".json"
      }
      const res = await axios.get(url).catch((error) => {
        console.log(error)
      })

      try {
        // Write to DB
        var newToken = {}
        newToken["tokenId"] = tokensToQuery[i]
        res.data.attributes.forEach((attr) => {
          var traitType = attr.trait_type.escapeSpecialChars()
          var traitTypeValue = attr.value.escapeSpecialChars()
          newToken[traitType] = traitTypeValue
        })
        neDbConnection.insert(newToken, function (err, newDoc) {})

        console.log(res.data.name)
      } catch (error) {
        console.log(error)
      }
    } else {
      // console.log("tokenId: " + tokensToQuery[i] + " already in Db")
    }
  }
}

function appendTraitScoreToTokens(tokensDb, rarityTraits) {
  var tokenTest = tokensDb.slice(0, 100)
  var tokenScores = tokenTest.map((token) => {
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
    return { tokenId: token.tokenId, sum: Math.round(sum) }
  })
  return tokenScores.sort((a, b) => parseFloat(b.sum) - parseFloat(a.sum))
}

function findUniqueTraits(tokensDb) {
  var uniqueTraitTypes = []
  tokensDb.forEach((token) => {
    for (var trait_type in token) {
      //only add if not there yet and not ids
      if (trait_type != "tokenId" && trait_type != "_id" && uniqueTraitTypes.indexOf(trait_type) === -1) {
        uniqueTraitTypes.push(trait_type)
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

function getEveryNth(arr, nth) {
  const result = []

  for (let i = 0; i < arr.length; i += nth) {
    result.push(arr[i])
  }

  return result
}
