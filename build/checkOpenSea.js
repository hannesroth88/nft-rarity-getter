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
const fs = require("fs");
const axios_1 = __importDefault(require("axios"));
require("dotenv").config();
const PROJECT_NAME = "stoics";
//load config
const config = JSON.parse(fs.readFileSync("config.json"));
// get project
const project = config.projects.find((project) => project.name == PROJECT_NAME);
const delay = (time) => new Promise((res) => setTimeout(res, time));
const threshold = 1;
main();
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const top100 = JSON.parse(fs.readFileSync("./db/" + PROJECT_NAME + "_top100.json"));
        const options = {
            headers: {
                "X-API-KEY": process.env["OPENSEA_API_KEY"]
            }
        };
        const interestingTokenListings = [];
        const interestingTokenOffers = [];
        for (let i = 0; i < top100.length; i++) {
            try {
                const asset = top100[i];
                const baseUrl = "https://api.opensea.io/api/v1/asset";
                const assetUrl = `https://opensea.io/assets/ethereum/${project.contractAddress}/${asset}`;
                const url = `${baseUrl}/${project.contractAddress}/${asset}`;
                console.log(assetUrl);
                // Listings
                const responseListing = yield axios_1.default.get(url + "/listings?limit=10", options);
                let allListings;
                if (responseListing.data.listings) {
                    allListings = [...responseListing.data.listings, ...responseListing.data.seaport_listings];
                }
                else {
                    allListings = responseListing.data.seaport_listings;
                }
                if (allListings.length > 0) {
                    const listings = allListings.sort(function (a, b) {
                        return b.current_price - a.current_price;
                    });
                    getListing(listings[0], asset, assetUrl, interestingTokenListings);
                }
                yield delay(100);
                // Offers
                const responseOffers = yield axios_1.default.get(url + "/offers?limit=10", options);
                let allOffers;
                if (responseOffers.data.offers) {
                    allOffers = [...responseOffers.data.offers, ...responseOffers.data.seaport_offers];
                }
                else {
                    allOffers = responseOffers.data.seaport_offers;
                }
                if (allOffers.length > 0) {
                    const offers = allOffers.sort(function (a, b) {
                        return b.current_price - a.current_price;
                    });
                    getOffer(offers[0], asset, assetUrl, interestingTokenOffers);
                }
                yield delay(100);
            }
            catch (error) {
                console.log(error);
            }
        }
        console.log({ interestingTokenListings: interestingTokenListings });
        console.log({ interestingTokenOffers: interestingTokenOffers });
    });
}
function getListing(data, asset, assetUrl, interestingTokenListings) {
    // be careful currency can't be checked anymore with data, do not write Bot on this
    if (data === null || data === void 0 ? void 0 : data.current_price) {
        const ethPrice = (data === null || data === void 0 ? void 0 : data.current_price) / 10 ** 18;
        console.log(`${ethPrice} ETH`);
        if (ethPrice < threshold) {
            const token = { id: asset, url: assetUrl, price: ethPrice };
            console.log(JSON.stringify({ listing: token }));
            interestingTokenListings.push(token);
        }
    }
}
function getOffer(data, asset, assetUrl, interestingTokenOffers) {
    var _a, _b;
    if ((data === null || data === void 0 ? void 0 : data.current_price) && (((_a = data === null || data === void 0 ? void 0 : data.payment_token_contract) === null || _a === void 0 ? void 0 : _a.symbol) == "ETH" || ((_b = data === null || data === void 0 ? void 0 : data.payment_token_contract) === null || _b === void 0 ? void 0 : _b.symbol) == "WETH")) {
        const ethPrice = (data === null || data === void 0 ? void 0 : data.current_price) / 10 ** 18;
        console.log(ethPrice);
        if (ethPrice < threshold) {
            const token = { id: asset, url: assetUrl, price: ethPrice };
            console.log(JSON.stringify({ offer: token }));
            interestingTokenOffers.push(token);
        }
    }
}
