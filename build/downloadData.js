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
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const nedb_1 = __importDefault(require("nedb"));
const fs = require("fs");
const MAX_SUPPLY_TOKEN = 3333;
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
        // get Data from Ipfs/Server
        yield downloadData(neDbConnection);
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
const delay = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const getIpfsTokens = function (neDbConnection, tokensDb, tokensToQuery, metaDataUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let i = 0; i < tokensToQuery.length; i++) {
            if (!tokensDb.some((item) => item.tokenId === tokensToQuery[i])) {
                let url = "";
                if (project.urlVariant == 1) {
                    url = metaDataUrl + "/" + tokensToQuery[i];
                }
                else if (project.urlVariant == 2) {
                    url = metaDataUrl + "/" + tokensToQuery[i] + ".json";
                }
                console.log(url);
                const res = yield axios_1.default.get(url);
                console.log("tokenId: " + tokensToQuery[i] + " not in Db, get data now,    DATE:" + new Date().toLocaleTimeString("de-DE") + "    url:" + url);
                yield delay();
                try {
                    // Write to DB
                    let newToken = {};
                    newToken["tokenId"] = tokensToQuery[i];
                    if (project.traitJsonType == 1) {
                        //@ts-ignore
                        res.data.attributes.forEach((attr) => {
                            let traitType = escapeSpecialChars(attr.trait_type);
                            let traitTypeValue = escapeSpecialChars(attr.value);
                            newToken[traitType] = traitTypeValue;
                        });
                    }
                    else if (project.traitJsonType == 2) {
                        //@ts-ignore
                        newToken = (newToken, res.data.attributes);
                    }
                    neDbConnection.insert(newToken, function (err, newDoc) { });
                }
                catch (error) {
                    //@ts-ignore
                    console.error(res.data);
                    console.error(error);
                }
            }
        }
    });
};
function downloadData(neDbConnection) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Download Data");
        neDbConnection.find({}, function (err, tokensDb) {
            return __awaiter(this, void 0, void 0, function* () {
                if (err)
                    return console.log(err);
                const tokenIdsDb = tokensDb.map((token) => token.tokenId);
                let tokenIds = Array.from({
                    length: MAX_SUPPLY_TOKEN
                }, (_, j) => j + 1);
                // filter out Ids which are already in DB
                const remainingIds = tokenIds.filter(function (el) {
                    return tokenIdsDb.indexOf(el) < 0;
                });
                console.log(remainingIds);
                if (project.isIpfs) {
                    // if there are many id metadata to fetch use multiple gateways
                    if (remainingIds.length >= config.ipfsGateways.length) {
                        const sizePerBatch = Math.ceil(remainingIds.length / config.ipfsGateways.length);
                        let tokenIdsSplit = [], size = sizePerBatch;
                        while (remainingIds.length > 0) {
                            tokenIdsSplit.push(remainingIds.splice(0, size));
                        }
                        console.log(tokenIdsSplit);
                        for (let i = 0; i < config.ipfsGateways.length; i++) {
                            yield getIpfsTokens(neDbConnection, tokensDb, tokenIdsSplit[i], config.ipfsGateways[i] + project.url);
                        }
                        // just use the first gateway
                    }
                    else {
                        yield getIpfsTokens(neDbConnection, tokensDb, remainingIds, config.ipfsGateways[0] + project);
                    }
                }
                else {
                    yield getIpfsTokens(neDbConnection, tokensDb, remainingIds, project.url);
                }
            });
        });
    });
}
