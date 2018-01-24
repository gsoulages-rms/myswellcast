const request = require("request");
const cheerio = require("cheerio");
const fs = require('fs');
const path = require('path'); 
const mkdirp = require('mkdirp');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').load();
  require('dotenv').config()
}

const express = require('express');
const bodyParser= require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({extended: true}));

app.listen(3000, () => {
  console.log('listening on 3000')
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
  console.log('hehe');
});

app.post('/quotes', (req, res) => {
  console.log(req.body)

  /* If less than hour or file doesn't exist, then make a new request */
  isCacheExpired();

  /* Makes request to 17ft */

  function getBouy(name) {

    let url = "http://17ft.com";
    let forecasts = [];

      request.get(url, (error, response, body) => {

        for (let x = 0; x < name.length; x++) {

        let report = [];

        $ = cheerio.load(body)

        $('td').filter(function(i, elem) {
          // Filter table by name, skip first sibling (its useless)
          // remove extraneous characters, and push into array
          if ($(this).text() === name[x]) {
            let siblings = $(this).next().siblings();
            siblings.each(function (i, elem) {
              if (i > 0) {
                let num = $(this).text().replace(/[^0-9-.]/g, "");
                report.push(num);
              } else {
                report.push($(this).text());
              }
            });
          }
        });

        // push array into forecast object
        let forecast = {
          bouyName : report[0],
          swellHeight : report[1],
          period : report[2],
          swellDirection : report[3],
          windSpeed : report[4],
          windDirection : report[5],
          waterTemp : report[6],
          date : Date.now()
        };

        forecasts.push(forecast);

      }

      fs.writeFile("./files/test.json", JSON.stringify(forecasts, null, 2), function(err) {
        if(err) {
          return console.log(err);
        }
        console.log("The file was saved!");
      }); 

    });

  }

  /* Cache layer */

  function isCacheExpired() {
    let hour = 1000 * 60 * 60;
    let anHourAgo = Date.now() - hour;
    let info;

    fs.exists('./files/test.json', function(exists) {
      if (exists) { 
        fs.readFile('./files/test.json', "utf8", function (err, data) {
          let forecastsData = JSON.parse(data);

          if (forecastsData[0].date <= anHourAgo || forecastsData[1].date <= anHourAgo) {
            console.log('its been longer than an hour, make a new request');
            getBouy(['Harvest, CA', 'WEST SANTA BARBARA']);
            sendEmail(forecastsData);
          } else {
            console.log('its been less than an hour, dispay contents from file');
            sendEmail(forecastsData);
          }

        });
      } else {
        console.log('File doesnt exist, making a new request');
        mkdirp('./files/', function(err) { 
          if (err) {
            console.log(err);
          } else {
            console.log('Directory successfully created!');
          }
        });
        getBouy(['Harvest, CA', 'WEST SANTA BARBARA']);
      }
    });

  }

  function sendEmail(forecastsData) {

    var readHTMLFile = function(path, callback) {
      fs.readFile(path, {encoding: 'utf-8'}, function (err, html) {
          if (err) {
              throw err;
              callback(err);
          }
          else {
              callback(null, html);
          }
      });
    };

    readHTMLFile('./emailTemplate/index.html', function(err, html) {
      var template = handlebars.compile(html);

      var replacements = {
        harvestName: forecastsData[0].bouyName,
        harvestHeight: forecastsData[0].swellHeight,
        harvestPeriod: forecastsData[0].period,
        harvestSwellDirection: forecastsData[0].swellDirection,
        harvestWaterTemp: forecastsData[0].waterTemp,
        sbName: forecastsData[1].bouyName,
        sbWindSpeed: forecastsData[1].windSpeed,
        sbWindDirection: forecastsData[1].windDirection,
      };
      
      console.log(`${process.env.EMAIL}`);
      
      var htmlToSend = template(replacements);

      let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
              user: `${process.env.EMAIL}`,
              pass: `${process.env.PASSWORD}`
          }
      });
      
      const mailOptions = {
        from: {
          name: 'Swellcast',
          address: `${process.env.EMAIL}`
        },
        to: `${process.env.EMAILTOGREGORY}, ${process.env.EMAILTOCHRISTIAN}`, // list of receivers
        subject: 'Santa Claus is firing!', // Subject line
        html : htmlToSend
      };
    
      transporter.sendMail(mailOptions, function (err, info) {
        if(err)
          console.log(err)
        else
          console.log(info);
      });

    });

  }
  
  res.redirect('/');

});