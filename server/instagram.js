import _ from 'lodash';
import logError from './lib/log-error';
import cache from './lib/hull-cache';
import axios from 'axios';
import moment from 'moment';

const INSTAGRAM_BASE = 'https://api.instagram.com/v1';
const INSTAGRAM_SUBSCRIPTION_URL = `${INSTAGRAM_BASE}/subscriptions`;
const INSTAGRAM_MEDIA_URL = `${INSTAGRAM_BASE}/media`;
const HOSTNAME = 'https://air.ngrok.io'; // need a way to access the current hostname from callback events.
const SHIP_TOKEN = process.env.SHIP_TOKEN || '398moi2309cmo2983m40';
const eu = encodeURIComponent;

export default {

  registerCallback(req, res) {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === SHIP_TOKEN) {
      res.send(req.query['hub.challenge']);
    } else {
      res.sendStatus(400);
    }
  },

  register({ subject, message }, { hull, ship }) {
    const { organization, id, secret } = hull.configuration();
    const cbu = `${HOSTNAME}/instagram/${eu(organization)}/${eu(id)}/${eu(secret)}`;
    hull.get('services').then((services) => {
      const { key, secret: instaSecret } = (_.find(services, {
        type: 'services/instagram_app'
      }) || {});
      function createSubscription() {
        return axios.post(INSTAGRAM_SUBSCRIPTION_URL, {
          data: {
            object: 'user',
            aspect: 'media',
            client_id: key,
            client_secret: instaSecret,
            verify_token: SHIP_TOKEN,
            callback_url: cbu
          }
        })
        .then((response) => {
          // If successful, store the subscription id in the ship
          // Ensure we don't trigger a ship update that would triger a re-register
          if (response && response.meta && response.meta.code === 200) {
            return hull.post(`${ship.id}`, { private_settings: { subscription_id: response.data.id }
            });
          }
          return response;
        });
      }

      function deleteSubscription(subscriptionId) {
        return axios.delete(INSTAGRAM_SUBSCRIPTION_URL, {
          client_id: key,
          client_secret: instaSecret,
          id: subscriptionId
        });
      }

      const { subscriptionId } = ship.private_settings;
      // Delete the previous subscription if we have one.
      if (subscriptionId) {
        console.log('Deleting subscription', subscriptionId);
        return deleteSubscription().then(createSubscription, createSubscription);
      }

      // No previous subscription stored, just create it.
      return createSubscription();
    }, logError)
    .catch(logError);
  },

  notify(req, res, next) {
    const { client } = req.hull;
    _.map(req.body, (post = {}) => {
      const { object, object_id: uid, data: { media_id: mid } } = post;
      if (object === 'user') {
        // Perform actions as the Hull user, with admin rights.
        const user = client.as(`instagram:${uid}`, true);

        // Get Settings to retreive instagram credentials - cached
        cache(user, 'app/settings')

        .then(({ auth: { instagram: { access_token: token } } }) =>
          // With the instagram token, fetch the newly created media
          axios.get(`${INSTAGRAM_MEDIA_URL}/${mid}?access_token=${token}`)
        , logError)

        .then((media = {}) => {
          const { status, data: { data } } = media;

          // Todo: we could update the user's instagram data from here.
          // console.log(data.user);
          // { username: 'unity',
          // profile_picture: 'https://scontent.cdninstagram.com/t51.2885-19/s150x150/1169138_1684969021751603_1313711738_a.jpg',
          // id: '361536',
          // full_name: 'Romain Dardour' }

          // Dig into the media to return the right info.
          if (!data || status !== 200) {
            throw new Error(`No Image found: status:${status} mid:${mid}`);
          }
          // UNIX timestamp
          const createdAt = moment(data.created_time, 'X').format();
          const context = {
            created_at: createdAt,
            source: 'instagram',
            ip: null,
            url: null,
            referer: null
          };
          const payload = {
            picture: data.images.standard_resolution.url,
            filter: data.filter,
            tags: data.tags.join(', '),
            location: data.location,
            instagram_id: data.id,
            description: data.caption
          };
          // Do a Hull track as the user.
          return user.track(`New instagram ${data.type}`, payload, context);
        }, logError)

        .catch(logError);
      }
    });
    res.sendStatus(200);
    next();
  }
};
