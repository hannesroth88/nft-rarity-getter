import Nedb from "nedb"

const projectName = "2112"

start()

async function start() {
  // fetch nedb entries
  var neDbConnection = new Nedb({
    filename: "./db/" + projectName + ".db",
    autoload: true
  })

  // Now we can query it the usual way
  neDbConnection.find({}, async function (err, tokensDb) {
    tokensDb.forEach((token) => {
      if (!token.Faction) {
        console.log(token._id); 
        neDbConnection.remove({ _id: token._id })
      }
    })
  })
}
