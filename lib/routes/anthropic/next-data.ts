import * as cheerio from 'cheerio';

const unescapeJsonString = (escaped: string) => JSON.parse(`"${escaped}"`);

export function extractNextFlightObjects(html: string): Record<string, any>[] {
    const $ = cheerio.load(html, { scriptingEnabled: false });

    // 只取 nonce 存在且非空的 <script>
    const scripts = $('script[nonce]').filter((_, el) => {
        const v = $(el).attr('nonce');
        return typeof v === 'string' && v.trim().length > 0;
    });

    // 固定格式：self.__next_f.push([ number, "escaped" ])
    const PUSH_RE = /self\.__next_f\.push\(\[\s*(\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]\)/g;

    const objects: Record<string, any>[] = [];

    scripts.each((_, el) => {
        const code = ($(el).html() ?? $(el).text() ?? '').toString();
        if (!code) {
            return;
        }

        let m: RegExpExecArray | null;
        while ((m = PUSH_RE.exec(code)) !== null) {
            const escaped = m[2];

            // 反转义得到类似：20:["$","$L2b",null,{...}]
            let unescaped: string;
            try {
                unescaped = unescapeJsonString(escaped);
            } catch {
                continue;
            }

            // 取冒号后的 JSON 数组：["$","$L2b",null,{...}]
            const colon = unescaped.indexOf(':');
            if (colon === -1) {
                continue;
            }

            const payloadStr = unescaped.slice(colon + 1).trim();

            // 解析为数组，并从中提取第一个对象 {}
            try {
                const payload = JSON.parse(payloadStr);
                if (Array.isArray(payload)) {
                    const obj = payload.find((v) => v && typeof v === 'object' && !Array.isArray(v));
                    if (obj) {
                        objects.push(obj as Record<string, any>);
                    }
                }
            } catch {
                // 忽略解析失败的片段
            }
        }
    });

    return objects;
}
