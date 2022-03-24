import express, { Request, Response } from 'express';
import axios from 'axios';
import { readdirSync, createWriteStream } from 'fs';
import { resolve } from 'path';
import { sign } from 'tweetnacl';
import { AdminUploadPayload } from './types';

const { adminToken, host, client, port = 80 } = require('../config.json');

let picCache: Array<{
	id: number;
	path: string;
}> = [];

function loadPics() {
	const files = readdirSync(resolve('data'))
	picCache = files.map((file, idx) => ({
		id: idx,
		path: file,
	}));
}

function pickRandom(): { id: number, path: string } {
	return picCache[Math.floor(Math.random() * picCache.length)];
}

async function addPic(url: string): Promise<string> {
	const nextID = picCache.length ? Math.max(...picCache.map(p => p.id)) + 1 : 1;

	const res = await axios({
		method: 'GET',
		url,
		responseType: 'stream',
	});

	const split = url.split('.');
	const ext = split[split.length - 1];
	const path = resolve('data/', `${nextID.toString()}.${ext}`);

	const stream = res.data.pipe(createWriteStream(path));
	return new Promise((res, rej) => {
		stream.on('error', (err: Error) => {
			rej(err);
		});
		stream.on('finish', () => {
			res(nextID.toString());
		});
	})
}


const server = express();
server.use(express.json());

server.get('/admin/reload', (req, res) => {
	if (!req.headers.authorization || req.headers.authorization !== adminToken) {
		return res.status(401).send('Unauthorized');
	}

	if (req.headers.authorization !== adminToken) {
		return res.status(403).send('Forbidden');
	}

	try {
		loadPics();
		return res.status(204).send('Success');
	} catch (err) {
		console.error(err);
		return res.status(500).send((err as Error).message);
	}
});

server.post('/admin/addfile', (req, res) => {
	if (!req.headers.authorization || req.headers.authorization !== adminToken) {
		return res.status(401).send('Unauthorized');
	}

	if (req.headers.authorization !== adminToken) {
		return res.status(403).send('Forbidden');
	}

	const { url } = req.body;

	if (!url) {
		return res.status(400).send('Bad Request');
	}

	addPic(url).then((newId) => {
		loadPics();
		return res.status(200).send(`http://${host}/pics/${newId}`);
	}).catch((err) => {
		console.error(err);
		return res.status(500).send((err as Error).message);
	});
});

server.get('/pics/:id', (req, res) => {
	const id = Number(req.params.id);
	const pic = picCache.find(p => p.id === id);

	if (!pic) {
		return res.status(404).send('Not Found');
	}

	return res.status(200).sendFile(pic.path, { root: __dirname });

});

server.get(['/', '/random'], (req, res) => {
	res.status(307).redirect(`/pics/${pickRandom().id}`);
});

if (client) {
	console.log('Client specified, creating interaction endpoint');
	function sallyPosterhandler(req: Request, res: Response) {
		return res.status(200).send({
			type: 4,
			embeds: [{
				color: 0xf04947,
				title: 'Found Sally!!!',
				footer: { text: 'Sally uwu' },
				timestamp: new Date,
				image: {
					url: `http://${host}/pics/${pickRandom().id}`
				}
			}],
		});
	}

	function sallyAdminHandler(req: Request, res: Response) {
		console.log('doing upload command')
		const user = req.body.member?.user?.id ?? req.body.user.id;
		if (!user || user !== client.adminId) {
			return res.status(200).send({
				type: 4,
				flags: 64,
				embeds: [{
					color: 0xf04947,
					description: '<:error:732383200436813846> Unknown command.'
				}],
			});
		}

		const snowflake = req.body.data.options[0].value;
		const url = req.body.data.resolved.attachments[snowflake].url;
		res.status(200).send({ type: 5, flags: 64 });
		console.log('deferred')
		addPic(url).then((newID) => {
			loadPics();
			axios.patch(`https://discord.com/api/v10/webhooks/${req.body.application_id}/${req.body.token}/messages/@original`, {
				embeds: [{
					color: 0xf04947,
					title: 'Upload complete',
					footer: { text: 'Sally uwu' },
					timestamp: new Date,
					image: {
						url: `http://${host}/pics/${newID}`,
					}
				}],
			}).catch(console.error);
		}).catch((err) => {
			console.error(err);
			axios.patch(`https://discord.com/api/v10/webhooks/${req.body.application_id}/${req.body.token}/messages/@original`, {
				embeds: [{
					color: 0xf04947,
					title: 'Upload failed',
					footer: { text: 'Sally uwu' },
					timestamp: new Date,
				}],
			}).catch(console.error);
		});
	}

	server.post('/interaction', (req, res) => {
		const sig = req.headers['x-signature-ed25519'] as string;
		const timestamp = req.headers['x-signature-timestamp'] as string;
		const key = client.key;
	
		if (!sig || !timestamp || !key) {
			console.log('malformed interaction');
			return res.status(401).end('invalid request signature');
		}

		const isVerified = sign.detached.verify(
			Buffer.from(timestamp + JSON.stringify(req.body)),
			Buffer.from(sig, 'hex'),
			Buffer.from(key, 'hex'),
		);

		if (!isVerified) {
			console.log('invalid interaction');
			return res.status(401).end('invalid request signature');
		}

		if (req.body.type === 1) {
			console.log('ping interaction');
			return res.status(200).send({ type: 1 });
		}
		console.log('doing app command')

		switch (req.body.data.name) {
			case 'sally': {
				return sallyPosterhandler(req, res);
			}

			case 'upload': {
				return sallyAdminHandler(req, res);
			}

			default: {
				return res.status(200).send({
					type: 4,
					flags: 64,
					embeds: [{
						color: 0xf04947,
						description: '<:error:732383200436813846> Unknown command.'
					}],
				});
			}
		}
	});
}

loadPics();
server.listen(Number(port));
