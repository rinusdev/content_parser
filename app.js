import jsdom from 'jsdom';
import fetch from 'node-fetch';
import https from 'https';
import fs from 'fs';
import path from 'path';

const __dirname = path.resolve();
const {JSDOM} = jsdom;
const mainLink = 'https://relaxkharkiv.com/';
let paginationLinks;

const main = async link => {
  fetch(link)
    .then(res => res.text())
    .then(res => {
      const dom = new JSDOM(res);
      const blocks = dom.window.document.querySelectorAll('.holder-block');

      if (!paginationLinks) {
        paginationLinks = [...new Set([...dom.window.document.querySelectorAll('.pagination a.page-link')]
          .map(a => `https:${a.href.trim()}`))];
        paginationLinks.shift();
      }

      if (paginationLinks.length) {
        main(paginationLinks.shift());
      }

      blocks.forEach((item, i) => {
        const url = `https:${item.querySelector('.box').href}`;
        saveProfile(url);
      });
    })
    .catch(console.log);
}

const saveProfile = async url => {

  fetch(url)
    .then(res => res.text())
    .then(res => {
      const dom = new JSDOM(res);
      const document = dom.window.document;
      const photoUrls = Array.from(document.querySelectorAll('.photo-gallery li'))
        .map(li => li.getAttribute('data-src'));
      const photoPromoUrl = document.querySelector('.promo-photo a')?.href;
      const name = document.querySelector('h2')
        .textContent
        .trim()
        .replace(/\s/g, '_');
      const profile = document.getElementById('profile');
      const phone = profile.querySelector('.phone a').textContent.trim();
      const id = phone.substring(4)
        .replace(')', '')
        .replace(/-/g, '');
      const entityPath = path.resolve(__dirname, 'data', `${name}_${id}`);

      fs.mkdir(entityPath, {recursive: true}, err => {
        if (err) {
          throw err;
        }

        photoPromoUrl && photoUrls.push(photoPromoUrl);

        photoUrls.forEach((photoUrl, i) => {
          const ext = photoUrl.match(/\.[^\.]+$/)[0];
          const photoName = `photo_${i + 1}${ext}`;

          const ws = fs.createWriteStream(path.resolve(entityPath, photoName));
          https.get(photoUrl, function (response) {
            response.pipe(ws);
          });
        });

        const model = ['age', 'growth', 'weight', 'chest', 'hairColor', 'intimateHaircut'];

        const params = Object.fromEntries([...profile.querySelector('.block:nth-child(3)')
          .querySelectorAll('dd')]
          .map((item, i) => [model[i], item.textContent.trim()]));

        const price = () => {
          const prices = Array.from(profile.querySelector('.block .holder-table')
            .querySelectorAll('td'))
            .map(td => td.textContent.trim());
          const [_, oneHour, visitOneHour, _2, twoHours, visitTwoHours, _3, night, visitNight] = prices;

          return {
            'oneHour': {
              apartment: oneHour,
              visit: visitOneHour
            },
            'twoHours': {
              apartment: twoHours,
              visit: visitTwoHours
            },
            'night': {
              apartment: night,
              visit: visitNight
            },
          }
        };

        const info = JSON.stringify({
          name,
          phone,
          ...params,
          ...price(),
        }, null, 2);

        fs.writeFile(path.resolve(entityPath, 'info.json'), info, err => {
          if (err) {
            console.log(err);
          }
        })
      })
      ;
    })
    .catch(console.log)
};

main(mainLink).catch(console.log);
