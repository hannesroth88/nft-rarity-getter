import axios from 'axios'
import dotenv from 'dotenv'
dotenv.config()

//https://github.com/louischatriot/nedb
import Nedb from 'nedb'
import _, { map } from 'underscore';

/*
#########
Initialize
#########
*/

const maxSupplyToken = 600
// const metaDataUrl = "https://ipfs.io/ipfs/QmXdVyGUhqRVx9iJ5zv7D54cc2pLcpiGRRqnoDMkQWDCCz" // Metahero
const metaDataUrl = "https://ipfs.io/ipfs/Qmb18UGaozS7hWi9KKzBAhKesXdgL29mS5Tns5tyygZhJq" // coodles
const projectName = "coodles"

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
    var neDbConnection = new Nedb({ filename: "./db/"+ projectName + ".db", autoload: true });


    // Now we can query it the usual way
    neDbConnection.find({}, async function (err, tokensDb) {
        if (err) return console.log(err)

        // console.log(tokensDb)
        var token_ids = Array.from({ length: maxSupplyToken }, (_, j) => j + 1);
        const results = await getIpfsTokens(neDbConnection, tokensDb, token_ids, metaDataUrl);

        var uniqueTraitTypes = []
        tokensDb.forEach(token => {
            for (var trait_type in token) {
                //only add if not there yet and not ids
                if (trait_type != "tokenId" && trait_type != "_id" && uniqueTraitTypes.indexOf(trait_type) === -1) {
                    uniqueTraitTypes.push(trait_type)
                }
            }
        })

        var countTraits = []
        var rarityTraits = []
        console.log("uniqueTraitTypes: " + uniqueTraitTypes)
        uniqueTraitTypes.forEach((traitType) => {
            var counts = _.countBy(tokensDb, traitType)
            console.log("### TraitType: " + traitType + "###")
            // calculate Rarity in Percent
            var rarityPerTraitType = []
            for (var key in counts) {
                if (counts.hasOwnProperty(key)) {
                    var rarityPercent = counts[key]/tokensDb.length*100
                    // console.log(rarityPercent)
                    if (rarityPercent < 0.5){
                        console.log(`${key}: ${rarityPercent} ( ${counts[key]} / ${tokensDb.length})`)
                    }
                    rarityPerTraitType[key] = Math.round((rarityPercent + Number.EPSILON) * 100) / 100 // round 2 decimals
                    // rarityPerTraitType[key] = rarityPercent
                }
            }
            // countTraits[trait_type] = counts
            rarityTraits[traitType] = rarityPerTraitType
        })
        // console.log(countTraits)
        console.log(rarityTraits)

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
const getIpfsTokens = async function (neDbConnection, tokensDb, tokensToQuery, metaDataUrl) {
    let results = [];
    for (let i = 0; i < tokensToQuery.length; i++) {
        if (!tokensDb.some(item => item.tokenId === tokensToQuery[i])) {
            console.log("tokenId: " + tokensToQuery[i] + " not in Db, get data now")
            await delay();
            const res = await axios.get(
                metaDataUrl + "/" + tokensToQuery[i]
            ).catch(error => {
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