import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { NotifHandler } from 'hull';
import instagram from './instagram';

const handler = NotifHandler({
  onSubscribe() {
    console.warn('Hello new subscriber !');
    console.log(arguments);
  },
  events: {
    'ship:update': instagram.register
  }
});

const readmeRedirect = function (req, res) {
  res.redirect(`https://dashboard.hullapp.io/readme?url=https://${req.headers.host}`);
};

module.exports = function (config = {}) {
  const app = express();

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.post('/notify', handler);
  app.get('/instagram', instagram.callback);
  app.post('/instagram', instagram.notify);

  app.use(express.static(path.resolve(__dirname, '..', 'dist')));
  app.use(express.static(path.resolve(__dirname, '..', 'assets')));

  app.get('/', readmeRedirect);


  app.get('/readme', readmeRedirect);

  app.get('/manifest.json', (req, res) => {
    res.sendFile(path.resolve(__dirname, '..', 'manifest.json'));
  });

  app.listen(config.port);

  console.log(`Started on port ${config.port}`);

  return app;
};
