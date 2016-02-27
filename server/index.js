import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { NotifHandler } from 'hull';
import readmeRedirect from './lib/readme-redirect-middleware';
import hullDecorator from './lib/hull-decorator';
import instagram from './instagram';
import _ from 'lodash';

const hullHandlers = NotifHandler({
  onSubscribe() {
    console.warn('Hello new subscriber !');
  },
  events: {
    'ship:update': instagram.register
  }
});

const instagramHandlers = hullDecorator({
  onError(err) {
    console.warn('Boom error', err, err.stack);
  },
  handlers: _.pick(instagram, 'notify')
});


module.exports = function (config = {}) {
  const app = express();

  app.use(bodyParser.urlencoded({ extended: false }));
  app.use(bodyParser.json());

  app.get('/instagram/:organization/:id/:secret', instagram.registerCallback);
  app.post('/instagram/:organization/:id/:secret', instagramHandlers.notify);
  app.post('/notify', hullHandlers);

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
