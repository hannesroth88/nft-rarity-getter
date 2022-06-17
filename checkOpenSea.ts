const fs = require("fs")
import axios from "axios"
require("dotenv").config()

const PROJECT_NAME = "aswangtribe"

//load config
const config = JSON.parse(fs.readFileSync("config.json")) as Config
// get project
const project = config.projects.find((project) => project.name == PROJECT_NAME) as Project
const delay = (time) => new Promise((res) => setTimeout(res, time))

const threshold = 0.5

main()

async function main() {
  const top100 = JSON.parse(fs.readFileSync("./db/" + PROJECT_NAME + "_top100.json"))

  const options = {
    headers: {
      "X-API-KEY": process.env["OPENSEA_API_KEY"]
    }
  }
  const interestingTokenListings: any[] = []
  const interestingTokenOffers: any[] = []
  for (let i = 0; i < top100.length; i++) {
    try {
      const asset = top100[i]

      const baseUrl = "https://api.opensea.io/api/v1/asset"
      const assetUrl = `https://opensea.io/assets/ethereum/0xa462127735352b1f03da8ab92a87803d05cc6a7b/${asset}`
      const url = `${baseUrl}/${project.contractAddress}/${asset}`
      console.log(url)

      // Listings
      const responseListing = await axios.get(url + "/listings?limit=10", options)
      const allListings = [...responseListing.data.listings, ...responseListing.data.seaport_listings]
      if (allListings.length > 0) {
        const listings = allListings.sort(function (a, b) {
          return b.current_price - a.current_price
        })
        getListing(listings, asset, assetUrl, interestingTokenListings)
      }
      await delay(100)

      // Offers
      const responseOffers = await axios.get(url + "/offers?limit=10", options)
      const allOffers = [...responseOffers.data.offers, ...responseOffers.data.seaport_offers]
      if (allOffers.length > 0) {
        const offers = allOffers.sort(function (a, b) {
          return b.current_price - a.current_price
        })
        getOffer(offers[0], asset, assetUrl, interestingTokenOffers)
      }

      await delay(100)
    } catch (error) {
      console.log(error)
    }
  }

  console.log({ interestingTokenListings: interestingTokenListings })
  console.log({ interestingTokenOffers: interestingTokenOffers })
}

function getListing(data, asset: any, assetUrl: string, interestingTokenListings: any[]) {
  if (data?.current_price && (data?.payment_token_contract?.symbol == "ETH" || data?.payment_token_contract?.symbol == "WETH")) {
    const ethPrice = data?.current_price / 10 ** 18
    const token = { id: asset, url: assetUrl, price: ethPrice }
    if (ethPrice < threshold) {
      console.log(JSON.stringify({ listing: token }))
      interestingTokenListings.push(token)
    }
  }
}

function getOffer(data, asset: any, assetUrl: string, interestingTokenOffers: any[]) {
  if (data?.current_price && (data?.payment_token_contract?.symbol == "ETH" || data?.payment_token_contract?.symbol == "WETH")) {
    const ethPrice = data?.current_price / 10 ** 18
    const token = { id: asset, url: assetUrl, price: ethPrice }
    if (ethPrice < threshold) {
      console.log(JSON.stringify({ offer: token }))
      interestingTokenOffers.push(token)
    }
  }
}
