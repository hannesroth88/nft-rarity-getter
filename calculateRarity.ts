import axios from "axios"
import dotenv from "dotenv"
dotenv.config()

import Nedb from "nedb"
import _, { map } from "underscore"
const fs = require("fs")

const MAX_SUPPLY_TOKEN = 1000
const PROJECT_NAME = "metaheros"

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

  // load Db again
  await calculateRarity(neDbConnection)
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


async function calculateRarity(neDbConnection: Nedb<any>) {
  neDbConnection.find({}, async function (err: any, tokensDb: any) {
    if (err) return console.log(err)

    let uniqueTraitTypes = findUniqueTraits(tokensDb)
    console.log("uniqueTraitTypes: " + uniqueTraitTypes)

    let rarityTraits = calculateTraits(uniqueTraitTypes, tokensDb)
    console.log("rarityTraits: " + rarityTraits)

    let tokenScores = appendTraitScoreToTokens(tokensDb, rarityTraits)
    const valuableTokenScores = tokenScores.slice(0, 100)
    const tokenScoresTop10 = valuableTokenScores.slice(0, 10)
    console.log("Top 10 TokenIDs: " + JSON.stringify(tokenScoresTop10, null, 2))

    let valuableTokenIds = valuableTokenScores.map((token: { tokenId: any }) => {
      return token.tokenId
    })
    console.log("Top 100 TokenIDs: [" + valuableTokenIds + "]")
  })
}


function appendTraitScoreToTokens(tokensDb: any, rarityTraits: any[]) {
  var tokenScores = tokensDb.map((token) => {
    let sum = 0
    for (const key in token) {
      var scorePerTrait
      // do for every key except for tokenId and _id
      if (key != "tokenId" && key != "_id") {
        // weights of certain traitTypes
        const traitIsInArray = project.traitWeights.filter((trait) => trait.key == key)
        if (traitIsInArray.length > 0) {
          scorePerTrait = (100 - rarityTraits[key][token[key]]) * traitIsInArray[0].weight
        } else {
          scorePerTrait = 100 - rarityTraits[key][token[key]]
        }
        sum = sum + scorePerTrait
      }
    }
    return {
      tokenId: token.tokenId,
      sum: Math.round(sum)
    }
  })
  return tokenScores.sort((a, b) => parseFloat(b.sum) - parseFloat(a.sum))
}

function findUniqueTraits(tokensDb: any[]) {
  let uniqueTraitTypes: string[] = []
  tokensDb.forEach((token: any) => {
    for (var traitType in token) {
      //only add if not there yet and not ids
      if (traitType != "tokenId" && traitType != "_id" && uniqueTraitTypes.indexOf(traitType) === -1) {
        uniqueTraitTypes.push(traitType)
      }
    }
  })
  return uniqueTraitTypes
}

function calculateTraits(uniqueTraitTypes: any[], tokensDb: string | any[]) {
  let rarityTraits: any = []
  uniqueTraitTypes.forEach((traitType) => {
    let counts = _.countBy(tokensDb, traitType)
    console.log("### TraitType: " + traitType + "###")
    // calculate Rarity in Percent
    let rarityPerTraitType = []
    for (var key in counts) {
      if (counts.hasOwnProperty(key)) {
        let rarityPercent = (counts[key] / tokensDb.length) * 100
        if (rarityPercent < 0.5) {
          console.log(`${key}: ${rarityPercent} ( ${counts[key]} / ${tokensDb.length})`)
        }
        rarityPerTraitType[key] = Math.round((rarityPercent + Number.EPSILON) * 100) / 100 // round 2 decimals
      }
    }
    rarityTraits[traitType] = rarityPerTraitType
  })
  return rarityTraits
}
