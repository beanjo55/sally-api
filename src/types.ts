//idfk how to type express so ill prob never use these body payloads, but theyre here if i ever figure it out
export type BaseInteraction = {
	id: string;
	type: 1 | 2;
	version: 1;
	application_id: string;
	guild_id?: string;
	channel_id?: string;
	token: string;
} & OneOf<{
	member: {
		nick?: string;
		roles?: Array<string>;
		avatar?: string;
		pending?: boolean;
		joined_at: string;
		user: User
	},
	user: User
}>;

interface User {
	is: string;
	username: string;
	discriminator: string;
	avatar?: string;
	bot?: boolean;
}

type ValueOf<Obj> = Obj[keyof Obj];
type OneOnly<Obj, K extends keyof Obj> = { [key in Exclude<keyof Obj, K>]: null } & { [key in K]: Obj[K] };
type OneOfByKey<Obj> = { [key in keyof Obj]: OneOnly<Obj, key> };
export type OneOf<T> = ValueOf<OneOfByKey<T>>;

export interface PicInteractionPayload {
	name: 'sally';
	id: string;
	type: 1;
}

export interface AdminUploadPayload {
	id: string;
	name: 'upload';
	type: 1;
	resolved: {
		attachments: {
			[key: string]: {
				id: string;
				filename: string;
				url: string;
				proxy_url: string;
			}
		}
	};
	options: [{
		name: 'image';
		type: 11;
		value: string;
	}]
}

export type UploadCommand = BaseInteraction & { data: AdminUploadPayload };
export type PicCommand = BaseInteraction & { data: PicInteractionPayload };
export type command = UploadCommand | PicCommand;