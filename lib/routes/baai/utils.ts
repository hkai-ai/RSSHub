import { destr } from 'destr';

import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';
import timezone from '@/utils/timezone';

const baseUrl = 'https://hub.baai.ac.cn';
const eventUrl = 'https://event.baai.ac.cn';
const apiHost = 'https://hub-api.baai.ac.cn';

const getTagsData = () =>
    cache.tryGet('baai:tags', async () => {
        const { data } = await ofetch(`${apiHost}/api/v1/tags`);
        return data.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            brief: item.brief,
            iconUrl: item.icon_url,
        }));
    });

const parseItem = (item) => {
    const isEvent = Boolean(item?.is_event && item?.event_info);
    const storyInfo = item?.story_info || {};
    const storyId = item?.story_id ?? storyInfo.id;
    const rawCreatedAt = String(storyInfo.created_at || '')
        .replace('发布', '')
        .replace('分享', '')
        .trim();
    const tagNames = Array.isArray(storyInfo.tag_names) ? storyInfo.tag_names.map((tag) => tag?.title).filter(Boolean) : [];

    return {
        link: isEvent ? `${eventUrl}/activities/${item.event_info.id}` : `${baseUrl}/view/${storyId}`,
        title: isEvent ? item.event_info.name : storyInfo.title,
        description: isEvent ? '' : storyInfo.content || storyInfo.title || '',
        pubDate: timezone(parseDate(isEvent ? item.event_info.time_desc : rawCreatedAt), 8),
        author: isEvent ? item.event_info.company : storyInfo.user_name,
        category: isEvent ? null : tagNames,
        eventId: isEvent ? item.event_info.id : null,
        is_event: isEvent,
    };
};

const parseEventDetail = async (item) => {
    const data = await ofetch(`${eventUrl}/api/api/Activity/IntroductionTypes`, {
        query: {
            activityId: item.eventId,
        },
        parseResponse: (txt) => destr(txt),
    });
    return (data?.data?.ac_desc || '') + (data?.data?.ac_desc_two || '');
};

export { apiHost, baseUrl, eventUrl, getTagsData, parseEventDetail, parseItem };
