"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const nedb_1 = __importDefault(require("nedb"));
const underscore_1 = __importDefault(require("underscore"));
const fs = require("fs");
const MAX_SUPPLY_TOKEN = 1000;
const PROJECT_NAME = "aswangtribe";
//load config
const config = JSON.parse(fs.readFileSync("config.json"));
// get project
const project = config.projects.find((project) => project.name == PROJECT_NAME);
start();
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        // fetch nedb entries
        const neDbConnection = new nedb_1.default({
            filename: "./db/" + project.name + ".db",
            autoload: true
        });
        // load Db again
        yield calculateRarity(neDbConnection);
    });
}
//replace forbidden characters for JSON
function escapeSpecialChars(string) {
    return string
        .replace(/\\n/g, "_")
        .replace(/\\'/g, "_")
        .replace(/\\"/g, "_")
        .replace(/\\&/g, "_")
        .replace(/\\r/g, "_")
        .replace(/\\t/g, "_")
        .replace(/\\b/g, "_")
        .replace(/\\f/g, "_")
        .replace(/\s/g, "_");
}
function calculateRarity(neDbConnection) {
    return __awaiter(this, void 0, void 0, function* () {
        neDbConnection.find({}, function (err, tokensDb) {
            return __awaiter(this, void 0, void 0, function* () {
                if (err)
                    return console.log(err);
                let uniqueTraitTypes = findUniqueTraits(tokensDb);
                console.log("uniqueTraitTypes: " + uniqueTraitTypes);
                let rarityTraits = calculateTraits(uniqueTraitTypes, tokensDb);
                console.log("rarityTraits: " + rarityTraits);
                let tokenScores = appendTraitScoreToTokens(tokensDb, rarityTraits);
                const valuableTokenScores = tokenScores.slice(0, 100);
                const tokenScoresTop10 = valuableTokenScores.slice(0, 10);
                console.log("Top 10 TokenIDs: " + JSON.stringify(tokenScoresTop10, null, 2));
                let valuableTokenIds = valuableTokenScores.map((token) => {
                    return token.tokenId;
                });
                console.log("Top 100 TokenIDs: [" + valuableTokenIds + "]");
                // save top 100 to json
                let data = JSON.stringify(valuableTokenIds);
                fs.writeFileSync("./db/" + project.name + "_top100.json", data);
                // Generate Links
                valuableTokenIds.forEach((item) => {
                    console.log(`https://opensea.io/assets/ethereum/0xa462127735352b1f03da8ab92a87803d05cc6a7b/${item}`);
                });
            });
        });
    });
}
function appendTraitScoreToTokens(tokensDb, rarityTraits) {
    var tokenScores = tokensDb.map((token) => {
        let sum = 0;
        for (const key in token) {
            var scorePerTrait;
            // do for every key except for tokenId and _id
            if (key != "tokenId" && key != "_id") {
                // weights of certain traitTypes
                const traitIsInArray = project.traitWeights.filter((trait) => trait.key == key);
                if (traitIsInArray.length > 0) {
                    scorePerTrait = (100 - rarityTraits[key][token[key]]) * traitIsInArray[0].weight;
                }
                else {
                    scorePerTrait = 100 - rarityTraits[key][token[key]];
                }
                sum = sum + scorePerTrait;
            }
        }
        return {
            tokenId: token.tokenId,
            sum: Math.round(sum)
        };
    });
    return tokenScores.sort((a, b) => parseFloat(b.sum) - parseFloat(a.sum));
}
function findUniqueTraits(tokensDb) {
    let uniqueTraitTypes = [];
    tokensDb.forEach((token) => {
        for (var traitType in token) {
            //only add if not there yet and not ids
            if (traitType != "tokenId" && traitType != "_id" && uniqueTraitTypes.indexOf(traitType) === -1) {
                uniqueTraitTypes.push(traitType);
            }
        }
    });
    return uniqueTraitTypes;
}
function calculateTraits(uniqueTraitTypes, tokensDb) {
    let rarityTraits = [];
    uniqueTraitTypes.forEach((traitType) => {
        let counts = underscore_1.default.countBy(tokensDb, traitType);
        console.log("### TraitType: " + traitType + "###");
        // calculate Rarity in Percent
        let rarityPerTraitType = [];
        for (var key in counts) {
            if (counts.hasOwnProperty(key)) {
                let rarityPercent = (counts[key] / tokensDb.length) * 100;
                if (rarityPercent < 0.5) {
                    console.log(`${key}: ${rarityPercent} ( ${counts[key]} / ${tokensDb.length})`);
                }
                rarityPerTraitType[key] = Math.round((rarityPercent + Number.EPSILON) * 100) / 100; // round 2 decimals
            }
        }
        rarityTraits[traitType] = rarityPerTraitType;
    });
    return rarityTraits;
}
