import restler from 'restler';
import _ from 'lodash';
import Hull from 'hull';

const INSTAGRAM_SUBSCRIPTION_URL = 'https://api.instagram.com/v1/subscriptions';
const HOSTNAME = 'https://air.ngrok.io'; // need a way to access the current hostname from callback events.
const SHIP_TOKEN = process.env.SHIP_TOKEN || '398moi2309cmo2983m40';

export default {
  callback(req, res) {
    if (req.param('hub.mode') === 'subscribe' && req.param('hub.verify_token') === SHIP_TOKEN) {
      res.send(req.param('hub.challenge'));
    } else {
      res.send(400);
    }
  },

  register({ subject, message }, { hull, ship }) {
    // TODO:
    // This is the Ship Id/Secret, even if named platform right?
    const { orgUrl, platformId, platformSecret } = hull.configuration();

    // TODO:
    // Check that the callback url accepts querystring parameters on Instagram.
    // Otherwise we have to make it path params and create a new endpoint for each.
    const callbackUrl = `https://${HOSTNAME}/instagram?orgUrl=${orgUrl}&id=${platformId}&secret=${platformSecret}`;

    // TODO:
    // How to get the current services config without an additional call to the api.
    // Caching is problematic since we don't know how to expire it (Unless we have notifications)
    hull.api('/services').then((services) => {
      const { key, secret } = _.find(services, { type: 'services/instagram_app' });
      function createSubscription() {
        restler.post(INSTAGRAM_SUBSCRIPTION_URL, {
          data: {
            object: 'user',
            aspect: 'media',
            client_id: key,
            client_secret: secret,
            verify_token: SHIP_TOKEN,
            callback_url: callbackUrl
          }
        })
        .on('success', (response) => {
          // If successful, store the subscription id in the ship
          if (response && response.meta && response.meta.code === 200) {
            hull.api(`${ship.id}`, 'POST', { private_settings: { subscription_id: response.data.id }
            });
          }
        });
      }
      const { subscriptionId } = ship.private_settings;
      // Delete the previous subscription if we have one.
      if (subscriptionId) {
        return restler.del(INSTAGRAM_SUBSCRIPTION_URL, {
          client_id: key,
          client_secret: secret,
          id: subscriptionId
        })
        .on('success', createSubscription);
      }
      // No previous subscription stored, just create it.
      return createSubscription();
    });
  },

  notify(req, res) {
    // TODO:
    // DOES NOT WORK YET:
    // How to get ship's config in external webhook cycle, without an additional call to api
    // How to create an event coming from the outside, that's authenticated and namespaced
    // How to store data for a user with only a given instagram ID

    console.log('Instagram request body:');
    console.log(req.body);

    const hull = new Hull({
      orgUrl: req.query.orgUrl,
      platformId: req.query.id,
      platformSecret: req.query.secret
    });

    // We're re-fetching the ship id to get it's config. that sucks.
    // Caching could help but it shouldn't be out of hull-node: it's already done there
    hull.get(req.query.id).then((ship) =>
      // This part is completely fake, but it shows the syntax that would work best
      hull
      // Do the next steps as the instagram user.
      // It would be a pretty syntax and would work since hull was initialized with a secret
      // It could allow impersonating a user given only it's ID.
      .as({ instagram: { uid: req.user.id } })
      // The tracking call could be done as this user, but with a secret
      // which would allow to add the 3rd parameter: a hash with admin options
      // such as the "event source" or "namespace"
      // Note the namespace uses the key in the manifest, which doesnt exist yet.
      // I would NOT enforce unicity of key for now since we might want multiple ships
      // doing stuff on instagram. Short version: We don't know the use case yet, so we leave it open.
      .track('new instagram picture', req.body, { namespace: ship.manifest.key })
      .then(() => {res.send(200);}
          , () => { res.send(200);}
      )
    );
  }
};
