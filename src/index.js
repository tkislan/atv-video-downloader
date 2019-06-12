// @flow

import fs from 'fs';
import path from 'path';

import axios from 'axios'
import throat from 'throat';

import config from './config'

const ETAG_CACHE_FILE = './.etag-cache.json';
const URL_QUALITY = 'uhd';
const DOWNLOAD_DIR = './.downloads';

type EtagCache = {[string]: string}

function getEtagCache(): Promise<EtagCache> {
  return new Promise((resolve, reject) => {
    fs.readFile(ETAG_CACHE_FILE, (error, data) => {
      if (error) return resolve({});

      try {
        return resolve(JSON.parse(data))
      } catch (error) {
        reject(error);
      }
    })
  })
}

function saveEtagCache(cache: EtagCache) {
  return new Promise((resolve, reject) => {
    fs.writeFile(ETAG_CACHE_FILE, JSON.stringify(cache, null, '  '), (error) => {
      if (error) return reject(error);
      resolve();
    })
  })
}

const addTag = throat(1, async (url: string, etag: string) => {
  const etagCache = await getEtagCache();
  await saveEtagCache({ ...etagCache, [url]: etag });
});

function getVideoList(): Array<{ name: string, url: string }> {
  return Object.values(config).reduce((acc, videoGroup) => ([
    ...acc,
    ...Object.entries(videoGroup).map(([name, urls]) => ({ name, url: urls[URL_QUALITY] })),
  ]), []).filter(({ url }) => !!url);
}

async function downloadFile(name: string, url: string, etag: ?string): Promise<void> {
  console.log(`Downloading ${name} from ${url} with etag ${etag}`);

  const filePath = path.join(DOWNLOAD_DIR, `${name}.mov`);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
    headers: fs.existsSync(filePath) && etag != null ? { 'If-None-Match': etag } : undefined,
    validateStatus: (status) => status < 400,
  });

  const { status, headers } = response;
  const { etag: responseEtag } = headers;
  switch (status) {
    case 200:
      break;
    case 304:
      return;
    default:
      throw Error(`Unexpected response status: ${status}`);
  }

  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      addTag(url, responseEtag).then(resolve, reject);
    });
    writer.on('error', reject);
  });
}

async function run() {
  const etagCache = await getEtagCache();

  const videoList = getVideoList();

  await Promise.all(
    videoList.map(
      throat(
        4,
        async (video) => {
          const { name, url } = video;
          await downloadFile(name, url, etagCache[url]);
        }
      )
    )
  );
}

console.log('Starting');
run().then(() => {
  console.log('Finished');
  process.exit(0);
}, (error) => {
  console.error(error);
  process.exit(1);
});
