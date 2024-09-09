const request = require("request-promise");
const cheerio = require("cheerio");

const express = require("express");
const axios = require("axios");

// todo
// - add cache (map) for album and title search links?

const router = express();

const toQueryString = (value) => value.replace(' ', '+');

const createQueryString = (attributes) => {
  return Object.keys(attributes)
    .map((attr) => `${attr}=${attributes[attr]}`)
    .join('&');
};

const getSearchUrl = (artist, title) => {
  const attributes = {
    bandName: toQueryString(artist),
    releaseTitle: toQueryString(title),
  };

  const query = createQueryString(attributes);

  return`https://www.metal-archives.com/search/ajax-advanced/searching/albums/?${query}`;
};

const getSearchResults = async (artist, title) => {
  const url = getSearchUrl(artist, title);
  const result = await axios.get(url);

  const arr = result.data["aaData"];

  // the first result
  const [ artistLinkElement, titleLinkElement ] = arr[0];

  const $1 = cheerio.load(artistLinkElement);
  const $2 = cheerio.load(titleLinkElement);

  return {
    artistLink: $1("a").attr("href"),
    albumLink: $2("a").attr("href"),
  };
};

router.get("/metallum/links", async (req, res) => {
  const { artist, title } = req.query;

  return res.send(await getSearchResults(artist, title));
});

router.get("/metallum/songs", async (req, res) => {
  const { artist, title } = req.query;

  const { albumLink } = await getSearchResults(artist, title);

  const html = await request.get(albumLink);
  const $ = cheerio.load(html);

  const tbody = $(".table_lyrics > tbody");

  const songs = [];
  tbody.find("tr").each((i, row) => {
    if ($(row).hasClass("even") || $(row).hasClass("odd")) {
      const cols = $(row).find("td");
      const songTitle = $(cols).eq(1).text().trim();
      const songLenght = $(cols).eq(2).text();
  
      songs.push({ songTitle, songLenght });
    }
  });

  return res.send(songs);
});

router.get("/metallum/cover", async (req, res) => {
  const { artist, title } = req.query;

  const { albumLink } = await getSearchResults(artist, title);

  const coverId = albumLink.split("/").pop();

  const baseUrl = "https://www.metal-archives.com/images/";

  const individuals = coverId.split("").slice(0, 4).join("/");

  const url = `${baseUrl}/${individuals}/${coverId}.jpg`;

  console.log("cover image search:", url);

  // https://stackoverflow.com/a/66542901
  request({ url: url, encoding: null }, (err, resp, buffer) => {
    if (!err && resp.statusCode === 200){
      res.set("Content-Type", "image/jpg");
      return res.send(resp.body);
    }
  });
});

const PORT = 3000;
const start = () => {
  router.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

start();
