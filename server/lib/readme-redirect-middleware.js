export default function (req, res) {
  res.redirect(`https://dashboard.hullapp.io/readme?url=https://${req.headers.host}`);
}
