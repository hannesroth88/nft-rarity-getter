import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

//https://github.com/louischatriot/nedb
import Nedb from 'nedb'

/*
#########
Initialize
#########
*/

const maxSupplyToken = 666
// const projectVariant = ["metaheros", "https://ipfs.io/ipfs/QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz", 1]
// const projectVariant = ["coodles", "https://ipfs.io/ipfs/QmSZGZH5fmbrhysZLNBnhmq4hMnjMgQsKzRdDTNZcLyqE5", 1]
// const projectVariant = ["shibaShelterNFT", "https://ipfs.io/ipfs/QmVbQmMvLCkUZxRoefJev8oTbVfwRjiEEP1s754Je3wQ43", 2]
const projectVariant = ["shibaShelterNFT", "https://gateway.pinata.cloud/ipfs/QmVbQmMvLCkUZxRoefJev8oTbVfwRjiEEP1s754Je3wQ43", 2]
const projectName = projectVariant[0]
const metaDataUrl = projectVariant[1]
const urlVariant = projectVariant[2]

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
    var neDbConnection = new Nedb({ filename: "./db/" + projectName + ".db", autoload: true });


    // Now we can query it the usual way
    neDbConnection.find({}, async function (err, tokensDb) {
        if (err) return console.log(err)

        // console.log(tokensDb)
        var token_ids = Array.from({ length: maxSupplyToken }, (_, j) => j + 1);
        await getIpfsTokens(neDbConnection, tokensDb, token_ids, metaDataUrl, urlVariant);

        var uniqueTraitTypes = findUniqueTraits(tokensDb);
        console.log("uniqueTraitTypes: " + uniqueTraitTypes);

        var rarityTraits = calculateTraits(uniqueTraitTypes, tokensDb);
        console.log("rarityTraits: " + rarityTraits)

        var tokenScores = appendTraitScoreToTokens(tokensDb, rarityTraits);
        console.log("tokenScores: " + tokenScores);
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
        .replace(/\s/g, '_');
};

const delay = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const getIpfsTokens = async function (neDbConnection, tokensDb, tokensToQuery, metaDataUrl, urlVariant) {
    let results = [];
    for (let i = 0; i < tokensToQuery.length; i++) {
        if (!tokensDb.some(item => item.tokenId === tokensToQuery[i])) {
            console.log("tokenId: " + tokensToQuery[i] + " not in Db, get data now, DATE:" + (new Date().toLocaleTimeString('de-DE')))
            await delay();
            var url
            if (urlVariant == 1) {
                url = metaDataUrl + "/" + tokensToQuery[i]
            } else if (urlVariant == 2) {
                url = metaDataUrl + "/" + tokensToQuery[i] + ".json"
            }
            const res = await axios.get(url)
                .catch(error => {
                    console.log(error);
                });

            try {
                // Write to DB
                var newToken = {}
                newToken["tokenId"] = tokensToQuery[i]
                res.data.attributes.forEach(attr => {
                    var traitType = attr.trait_type.escapeSpecialChars()
                    var traitTypeValue = attr.value.escapeSpecialChars()
                    newToken[traitType] = traitTypeValue
                });
                neDbConnection.insert(newToken, function (err, newDoc) {
                    // Callback is optional
                });

                console.log(res.data.name);
                results.push(res.data);

            } catch (error) {
                // console.log(res.data);
                console.log(error);
            }
        } else {
            // console.log("tokenId: " + tokensToQuery[i] + " already in Db")
        }
    }

    return results;
};

function appendTraitScoreToTokens(tokensDb, rarityTraits) {
    var tokenTest = tokensDb.slice(0, 100);
    var tokenScores = tokenTest.map(token => {
        var sum = 0;
        for (const key in token) {
            if (key != 'tokenId' && key != '_id') {
                // console.log(`key ${key}`)
                if (key === 'Origin') {
                    var scorePerTrait = (100 - rarityTraits[key][token[key]]) * 1.5;
                }
                else if (key === 'Identity') {
                    var scorePerTrait = (100 - rarityTraits[key][token[key]]) * 2;
                } else {
                    var scorePerTrait = 100 - rarityTraits[key][token[key]];
                }
                sum = sum + scorePerTrait;
            }
        }
        // console.log(`${token['tokenId']} : ${Math.round(sum)}`)
        return { 'tokenId': token.tokenId, 'sum': Math.round(sum) };
    });
    return tokenScores.sort((a, b) => parseFloat(a.sum) - parseFloat(b.sum));
}

function findUniqueTraits(tokensDb) {
    var uniqueTraitTypes = [];
    tokensDb.forEach(token => {
        for (var trait_type in token) {
            //only add if not there yet and not ids
            if (trait_type != "tokenId" && trait_type != "_id" && uniqueTraitTypes.indexOf(trait_type) === -1) {
                uniqueTraitTypes.push(trait_type);
            }
        }
    });
    return uniqueTraitTypes;
}

function calculateTraits(uniqueTraitTypes, tokensDb) {
    var rarityTraits = [];
    uniqueTraitTypes.forEach((traitType) => {
        var counts = _.countBy(tokensDb, traitType);
        console.log("### TraitType: " + traitType + "###");
        // calculate Rarity in Percent
        var rarityPerTraitType = [];
        for (var key in counts) {
            if (counts.hasOwnProperty(key)) {
                var rarityPercent = counts[key] / tokensDb.length * 100;
                // console.log(rarityPercent)
                if (rarityPercent < 0.5) {
                    console.log(`${key}: ${rarityPercent} ( ${counts[key]} / ${tokensDb.length})`);
                }
                rarityPerTraitType[key] = Math.round((rarityPercent + Number.EPSILON) * 100) / 100; // round 2 decimals

                // rarityPerTraitType[key] = rarityPercent
            }
        }
        // countTraits[trait_type] = counts
        rarityTraits[traitType] = rarityPerTraitType;
    });
    return rarityTraits;
}
