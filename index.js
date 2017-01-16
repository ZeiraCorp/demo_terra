const express = require("express");
const bodyParser = require("body-parser");
const Promise = require('promise');
const seneca = require('seneca')

const port = process.env.PORT || 8080;

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

app.use(express.static('public'));

const rediscli = require("redis").createClient({
  url:process.env.REDIS_URL
});

let getClient = (serviceId) => {
  return new Promise((resolve, reject) => {

    rediscli.get(serviceId, function (err, reply) {
      if(err || reply==null) {
        reject(err || reply)
      } else {
        let serviceInfos = JSON.parse(reply.toString())
        console.log("🤖 serviceInfos", serviceInfos)
        let client = seneca( {log: { level: 'silent' }}).client(serviceInfos)
        resolve(client)
      }
    });

  })
}

let getGatewayInfos = (gatewayKey) => {
  return new Promise((resolve, reject) => {
    rediscli.get(gatewayKey, (err, reply) => {
      if(err) reject(err)
      let gatewayInfos = JSON.parse(reply.toString())
      gatewayInfos.id = gatewayKey // this is the service id

      // check if gateway is ok
      getClient(gatewayInfos.id).then(client => {
        client.act({role: "hello", cmd: "yo"}, (err, item) => {
          if(err) {
            // timeout
            console.error(`😡 gateway ${gatewayInfos.id} is ko`)
            //delete from redis db
            rediscli.del(gatewayInfos.id, (err, reply) => {
              console.error(`🤢 gateway ${gatewayInfos.id} removed from db`)
            })

          } else {
            console.log(`😃 gateway ${gatewayInfos.id} is ok`,item)
          }

        })
      }).catch(err => console.log("🤢"))

      resolve(gatewayInfos)
    });
  })
}

// TODO: study how to use redis like a pro

app.get('/gateways/all', (req, res) => {
  rediscli.keys(
    "gateway-*", (err, reply) => {
      console.log(reply)
      res.send(JSON.parse(JSON.stringify(reply)))
    }
  );
});

//TODO
//smething working
//query the service yo
// remove fron redis db if don't exist

app.get('/gateways/details', (req, res) => {
  rediscli.keys(
    "gateway-*", (err, gatewaysList) => {
      let promises = gatewaysList.map(gatewayKey => {
        return getGatewayInfos(gatewayKey)
      })
      Promise.all(promises).then(gatewayData =>{
        console.log("🎃 All Gateways informations:", gatewayData)

        res.send(JSON.parse(JSON.stringify(gatewayData)))
      })
    }
  );
});


app.get('/services/yo', (req, res) => {
  // search all *gateway ...
  getClient("gateway-42-service-on-clever-cloud").then(client => {
    client.act({role: "hello", cmd: "yo"}, (err, item) => {
      res.send(item)
    })
  })

});

app.get('/services/product', (req, res) => {
  getClient("gateway-42-service-on-clever-cloud").then(client => {
    client.act({role:'math', cmd: 'product', a:40, b:20}, (err, item) => {
      console.log("item", item)
      let product = item
      res.send({product})
    })
  })
});

app.get('/services/sum', (req, res) => {
  getClient("gateway-42-service-on-clever-cloud").then(client => {
    client.act({role:'math', cmd: 'sum', a:4, b:2}, (err, item) => {
      console.log("item", item)
      let sum = item
      res.send({sum})
    })
  })
});


app.listen(port);
console.log(`🌍 Web Server is started - listening on ${port}`);

// test on Clever Cloud http://useyodemo.cleverapps.io/services/yo
