import { spotify } from '../lib/spotidown.js';

export default async function handler(req, res) {
	try {
		// CORS
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader(
			'Access-Control-Allow-Methods',
			'GET, OPTIONS'
		);
		res.setHeader(
			'Access-Control-Allow-Headers',
			'Content-Type'
		);

		if (req.method === 'OPTIONS') {
			return res.status(200).end();
		}

		if (req.method !== 'GET') {
			return res.status(405).json({
				status: false,
				message: 'Method not allowed'
			});
		}

		const query = req.query || {};

		const url =
			query.url ||
			query.link ||
			query.q;

		if (!url) {
			return res.status(400).json({
				status: false,
				message: 'Parameter url wajib diisi.',
				usage:
					'/api/spotify?url=https://open.spotify.com/track/xxxxx'
			});
		}

		if (
			typeof url !== 'string' ||
			!url.trim()
		) {
			return res.status(400).json({
				status: false,
				message: 'URL Spotify tidak valid.'
			});
		}

		const result = await spotify(
			url.trim()
		);

		return res.status(200).json({
			status: true,
			result
		});

	} catch (error) {
		console.error(
			'SPOTIDOWN API ERROR:',
			error
		);

		return res.status(500).json({
			status: false,
			message:
				error?.message ||
				'Terjadi kesalahan pada server.',
			error:
				process.env.NODE_ENV === 'development'
					? String(error)
					: undefined
		});
	}
}