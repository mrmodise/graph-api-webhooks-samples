const axios = require('axios');
const bodyParser = require('body-parser');
const express = require('express');

const SERVER_PORT = process.env.PORT || 5000;
const app = express();
app.use(bodyParser.json());

/////////////////////////////////////////////////////////////////////////
//           Part 1: Subscribe a leadgen endpoint to webhook           //
/////////////////////////////////////////////////////////////////////////

// A token that Facebook will echo back to you as part of callback URL verification.
const VERIFY_TOKEN = process.env.TOKEN;
const received_updates = [];

app.get('/', (req, res) => {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '</pre>');
});

// Endpoint for verifying webhook subscripton
app.get('/leadgen', (req, res) => {
  if (!req.query) {
    res.send({success: false, reason: 'Empty request params'});
    return;
  }
  // Extract a verify token we set in the webhook subscription and a challenge to echo back.
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (!verifyToken || !challenge) {
    res.send({
      success: false,
      reason: 'Missing hub.verify_token and hub.challenge params',
    });
    return;
  }

  if (verifyToken !== VERIFY_TOKEN) {
    res.send({success: false, reason: 'Verify token does not match'});
    return;
  }
  // We echo the received challenge back to Facebook to finish the verification process.
  res.send(challenge);
});

/////////////////////////////////////////////////////////////////////////
//                  Part 2: Retrieving realtime leads                  //
/////////////////////////////////////////////////////////////////////////

// Graph API endpoint
const GRAPH_API_VERSION = 'v2.12';
const GRAPH_API_ENDPOINT = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const xhub = require('express-x-hub');
const accessToken = process.env.TOKEN;
// Facebook will post realtime leads to this endpoint if we've already subscribed to the webhook in part 1.
app.post('/leadgen', (req, res) => {
  const entry = req.body.entry;

  entry.forEach(page => {
    page.changes.forEach(change => {
      // We get page, form, and lead IDs from the change here.
      // We need the lead gen ID to get the lead data.
      // The form ID and page ID are optional. You may want to record them into your CRM system.
      const {page_id, form_id, leadgen_id} = change.value;
      console.log(
          `Page ID ${page_id}, Form ID ${form_id}, Lead gen ID ${leadgen_id}`
      );

      // Call graph API to request lead info with the lead ID and access token.
      const leadgenURI = `${GRAPH_API_ENDPOINT}/${leadgen_id}?access_token=${accessToken}`;

      axios(leadgenURI)
          .then(response => {
            const {created_time, id, field_data} = response.data;

            // Handle lead answer here (insert data into your CRM system)
            console.log('Lead id', id);
            console.log('Created time', created_time);
            field_data.forEach(field => {
              console.log('Question ', field.name);
              console.log('Answers ', field.values);
            });
          })
          .catch(error => {
            // Handle error here
            console.log(error);
          });
    });
  });
  // Send HTTP 200 OK status to indicate we've received the update.
  res.sendStatus(200);
});

// Start web server
app.listen(SERVER_PORT, () =>
    console.log(`Server is listening at localhost:${SERVER_PORT}`)
);


app.get(['/facebook', '/instagram'], function(req, res) {
  if (
      req.query['hub.mode'] === 'subscribe' &&
      req.query['hub.verify_token'] === accessToken
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  // Process the Facebook updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});
