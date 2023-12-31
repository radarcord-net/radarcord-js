import Discord from "discord.js";
import axios from "axios";
import { RadarcordError } from "./errors/RadarcordError";
import {
    IntervalPreset,
    Review,
    StatsPostBody,
    StatsPostCallback,
    StatsPostResult,
    getTimeout,
    isOk,
    throwBadStatusCodeError,
} from "./utils";
import { apiRoot } from "./globals";

export default class RadarcordClient {
    public dJSClient: Discord.Client;
    public authorization: string;

    constructor(dJSClient: Discord.Client, authToken: string) {
        if (!(dJSClient instanceof Discord.Client))
            throw new TypeError(
                "Your client argument must be a type of Discord.js Client!"
            );
        this.dJSClient = dJSClient;
        this.authorization = authToken;
    }

    private _ensureThereIsClientUser(): boolean {
        return this.dJSClient.readyAt !== null;
    }

    /**
     * Posts stats to the Radarcord API once, then returns a `StatsPostResult`.
     *
     * Use `autopostStats` to have the posts be sent automatically over a certain interval.
     * @param shardCount How many shards your bot has, if any. Defaults to 1.
     * @returns A Promise that resolves to a `StatsPostResult`.
     */
    public async postStats(shardCount: number = 1): Promise<StatsPostResult> {
        if (!this._ensureThereIsClientUser())
            throw new RadarcordError(
                "The client is not logged in! Please try this again in your ready event!"
            );
        const guildCount = this.dJSClient.guilds.cache.size;
        const res = await axios
            .post(
                `${apiRoot}/bot/${this.dJSClient.user!.id}/stats`,
                {
                    guilds: guildCount,
                    shards: shardCount,
                },
                {
                    headers: {
                        Authorization: this.authorization,
                    },
                }
            )
            .catch((err) => {
                throw new RadarcordError(`Request failed: ${err}`);
            });

        if (!isOk(res.status)) throwBadStatusCodeError(res);

        return {
            message: "Stats posted successfully!",
            statusCode: res.status,
            body: res.data as StatsPostBody,
        };
    }

    /**
     * Automatically posts stats to the Radarcord API, but does not return anything.
     *
     * Use `postStats` to get the response.
     *
     * @param [shardCount=1] The amount of shards your bot has, if any. Defaults to 1.
     * @param [timeoutInterval=IntervalPreset.Default] The interval preset to use, defaults to the `Default` preset (120 seconds).
     */
    public async autopostStats(
        shardCount: number = 1,
        timeoutInterval: IntervalPreset = IntervalPreset.Default
    ) {
        await this.postStats(shardCount);

        const timeout = getTimeout(timeoutInterval);

        setInterval(async () => {
            await this.postStats(shardCount);
        }, timeout * 1000);
    }

    /**
     * Posts stats, then runs a callback. Useful for logging your post result.
     * @param callback Your callback to have run after posting the stats.
     * @param shardCount The amount of shards your bot has, if any. Defaults to 1.
     */
    public async postWithCallback(
        callback: StatsPostCallback,
        shardCount: number = 1
    ) {
        const result = await this.postStats(shardCount);

        if (typeof callback === "function") await callback(result);
    }

    /**
     * Autoposts stats and runs a callback every time a post is completed.
     *
     * Useful to keep getting your logs.
     * @param callback Your callback to have run after posting the stats.
     * @param shardCount The amount of shards your bot has, if any. Defaults to 1.
     * @param timeoutInterval The interval preset to use, defaults to the `Default` preset (120 seconds).
     */
    public async autopostWithCallback(
        callback: StatsPostCallback,
        shardCount: number = 1,
        timeoutInterval: IntervalPreset = IntervalPreset.Default
    ) {
        await this.postWithCallback(callback, shardCount);

        const timeout = getTimeout(timeoutInterval);

        setInterval(async () => {
            await this.postWithCallback(callback, shardCount);
        }, timeout * 1000);
    }

    /**
     * Gets all reviews your bot has, if any.
     * @returns A Promise which resolves to an array of reviews.
     */
    public async getReviews(): Promise<Review[]> {
        if (!this._ensureThereIsClientUser())
            throw new RadarcordError(
                "The client is not logged in! Please try this again in your ready event!"
            );
        const res = await axios
            .get(`${apiRoot}/bot/${this.dJSClient.user!.id}/reviews`)
            .catch((err) => {
                throw new RadarcordError(`Request failed: ${err}`);
            });

        if (!isOk(res.status)) throwBadStatusCodeError(res);

        const reviews: Review[] = [];

        for (const review of res.data.reviews) {
            reviews.push({
                content: String(review.content),
                stars: parseInt(review.stars),
                botId: String(review.botid),
                userId: String(review.userid),
            });
        }

        return reviews;
    }
}
