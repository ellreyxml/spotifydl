import axios from 'axios';
import * as cheerio from 'cheerio';

class SpotidownScraper {
	constructor() {
		this.baseUrl = 'https://spotidown.app';

		this.userAgent =
			'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
	}

	async _getSession() {
		const response = await axios.get(`${this.baseUrl}/en3`, {
			headers: {
				'User-Agent': this.userAgent,
				Accept:
					'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
				'Accept-Language': 'en-US,en;q=0.9'
			},
			timeout: 30000
		});

		const cookies = response.headers['set-cookie'] || [];

		const sessionCookie = cookies
			.map(v => v.split(';')[0])
			.join('; ');

		const $ = cheerio.load(response.data);

		const form = $('form[name="spotifyurl"]');

		let dynamicName = '';
		let dynamicValue = '';

		form.find('input[type="hidden"]').each((_, el) => {
			const name = $(el).attr('name');
			const value = $(el).attr('value');

			if (name && name !== 'g-recaptcha-response') {
				dynamicName = name;
				dynamicValue = value;
			}
		});

		return {
			sessionCookie,
			dynamicName,
			dynamicValue
		};
	}

	async search(query) {
		const {
			sessionCookie,
			dynamicName,
			dynamicValue
		} = await this._getSession();

		const payload = {
			url: query,
			'g-recaptcha-response': ''
		};

		if (dynamicName) {
			payload[dynamicName] = dynamicValue;
		}

		const response = await axios.post(
			`${this.baseUrl}/action`,
			new URLSearchParams(payload).toString(),
			{
				headers: {
					'User-Agent': this.userAgent,
					'Content-Type':
						'application/x-www-form-urlencoded; charset=UTF-8',
					Origin: this.baseUrl,
					Referer: `${this.baseUrl}/en3`,
					'X-Requested-With': 'XMLHttpRequest',
					Cookie: sessionCookie
				},
				timeout: 30000
			}
		);

		if (response.data.error) {
			throw new Error(
				response.data.message ||
				'Gagal melakukan pencarian.'
			);
		}

		const $ = cheerio.load(response.data.data);

		const tracks = [];

		$('form[name="submitspurl"]').each((_, form) => {
			const data = $(form)
				.find('input[name="data"]')
				.val();

			const base = $(form)
				.find('input[name="base"]')
				.val();

			const token = $(form)
				.find('input[name="token"]')
				.val();

			if (!data || !base || !token) {
				return;
			}

			let metadata = {};

			try {
				metadata = JSON.parse(
					Buffer
						.from(data, 'base64')
						.toString()
				);
			} catch {}

			tracks.push({
				metadata,
				form: {
					data,
					base,
					token
				}
			});
		});

		return {
			sessionCookie,
			tracks
		};
	}

	async download(form, sessionCookie) {
		const response = await axios.post(
			`${this.baseUrl}/action/track`,
			new URLSearchParams(form).toString(),
			{
				headers: {
					'User-Agent': this.userAgent,
					'Content-Type':
						'application/x-www-form-urlencoded; charset=UTF-8',
					Origin: this.baseUrl,
					Referer: `${this.baseUrl}/en3`,
					'X-Requested-With': 'XMLHttpRequest',
					Cookie: sessionCookie
				},
				timeout: 30000
			}
		);

		if (response.data.error) {
			throw new Error(
				response.data.message ||
				'Gagal mengambil download.'
			);
		}

		const $ = cheerio.load(response.data.data);

		let mp3 = null;
		let cover = null;

		$('a').each((_, el) => {
			const href = $(el).attr('href');

			const text = $(el)
				.text()
				.trim()
				.toLowerCase();

			if (!href) {
				return;
			}

			if (text.includes('download mp3')) {
				mp3 = href;
			}

			if (text.includes('download cover')) {
				cover = href;
			}
		});

		return {
			mp3,
			cover
		};
	}
}

const scraper = new SpotidownScraper();

export const spotifySearch = query => {
	return scraper.search(query);
};

export const spotifyDownload = (form, cookie) => {
	return scraper.download(form, cookie);
};

export async function spotify(query) {
	const {
		tracks,
		sessionCookie
	} = await spotifySearch(query);

	if (!tracks.length) {
		throw new Error('Lagu tidak ditemukan.');
	}

	const track = tracks[0];

	const links = await spotifyDownload(
		track.form,
		sessionCookie
	);

	if (!links.mp3) {
		throw new Error(
			'Link download tidak ditemukan.'
		);
	}

	return {
		title: track.metadata?.name || null,
		artist: track.metadata?.artists || null,
		download_url: links.mp3,
		cover: links.cover
	};
}