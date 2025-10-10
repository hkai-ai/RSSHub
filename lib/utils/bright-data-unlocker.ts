import { config } from '@/config';
import ofetch from '@/utils/ofetch';
import logger from '@/utils/logger';

const apiKey = config.brightdata?.apiKey || '';
const zone = config.brightdata?.unlockerZone || '';
const baseUrl = 'https://api.brightdata.com';

if (!apiKey) {
    logger.warn('Bright Data API key not configured. Set BRIGHTDATA_API_KEY environment variable.');
}
if (!zone) {
    logger.warn('Bright Data zone not configured. Set BRIGHTDATA_UNLOCKER_ZONE environment variable.');
}

const isConfigured = (): boolean => !!apiKey && !!zone;

export const unlockWebsite = async (url: string, options?: { country?: string }): Promise<string> => {
    if (!isConfigured()) {
        throw new Error('Bright Data Unlocker is not configured. Please set BRIGHTDATA_API_KEY and BRIGHTDATA_UNLOCKER_ZONE environment variables.');
    }

    try {
        logger.debug(`Making Bright Data Unlocker request to: ${url}`);

        const response = await ofetch(`${baseUrl}/request`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: {
                zone,
                url,
                format: 'raw',
                method: 'GET',
                country: options?.country,
            },
        });

        logger.debug(`Bright Data Unlocker response received for: ${url}`);
        return response;
    } catch (error) {
        logger.error(`Bright Data Unlocker request failed for ${url}:`, error);
        throw error;
    }
};

export const unlockWebsiteAsJSON = async (url: string, options?: { country?: string }) => {
    if (!isConfigured()) {
        throw new Error('Bright Data Unlocker is not configured. Please set BRIGHTDATA_API_KEY and BRIGHTDATA_UNLOCKER_ZONE environment variables.');
    }

    try {
        logger.debug(`Making Bright Data Unlocker JSON request to: ${url}`);

        const response = await ofetch(`${baseUrl}/request`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: {
                zone,
                url,
                format: 'json',
                method: 'GET',
                country: options?.country,
            },
        });

        logger.debug(`Bright Data Unlocker JSON response received for: ${url}`);
        return response;
    } catch (error) {
        logger.error(`Bright Data Unlocker JSON request failed for ${url}:`, error);
        throw error;
    }
};
