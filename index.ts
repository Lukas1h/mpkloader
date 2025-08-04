import { readdir } from "node:fs/promises";
import fs from "node:fs";
import { $, file } from "bun";
import path from "path";
import { createSelection, createPrompt } from 'bun-promptx'


const VIDEO_CACHE_DIRECTORY = "/Users/lukashahn/Developer/Web/mpkloader/videos";


type Language = {
    slug: string;
    name: string;
};

type Video = {
    isLocal: boolean;
    remoteURL?: string;
    localPath?: string;
    language: Language;
}

class MPKLoader {

    videoCache: string[] = [];
    languages: Language[] = []; // {"ayta-mag-antsi": "Ayta, Mag-Antsi", ...}

    constructor() { }

    async init() {
        await this.getLanguages()
        await this.buildCache()
    }



    async getLanguages() {
        // let response = await fetch("https://api-gateway.central.jesusfilm.org/", {
        //     body: `{"operationName":"GetLanguagesSlug","variables":{"id":"1_jf-0-0"},"query":"query GetLanguagesSlug($id: ID\u0021) {\\n  video(id: $id, idType: databaseId) {\\n    variantLanguagesWithSlug {\\n      slug\\n      language {\\n        id\\n        slug\\n        name {\\n          value\\n          primary\\n          __typename\\n        }\\n        __typename\\n      }\\n      __typename\\n    }\\n    __typename\\n  }\\n}"}`,
        //     method: "POST",
        //     headers: {
        //         "accept": "*/*",
        //         "accept-language": "en-US,en;q=0.8",
        //         "authorization": "undefined",
        //         "content-type": "application/json",
        //         "priority": "u=1, i",
        //         "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Brave\";v=\"138\"",
        //         "sec-ch-ua-mobile": "?1",
        //         "sec-ch-ua-platform": "\"Android\"",
        //         "sec-fetch-dest": "empty",
        //         "sec-fetch-mode": "cors",
        //         "sec-fetch-site": "same-site",
        //         "sec-gpc": "1",
        //         "x-graphql-client-name": "watch",
        //         "x-graphql-client-version": "ba942554aed0a05a2cd405ff2e8ef03ec9f4c845"
        //     }
        // });
        // console.log("Response status:", response);

        let languageFile = file("./languages.json");
        let json = await languageFile.json();
        let languages = json.data.video.variantLanguagesWithSlug;

        languages.forEach((lang: any) => {
            this.languages.push({
                slug: lang.language.slug,
                name: lang.language.name[0].value
            });
        });
    }

    getLanguagesForQuery(query: string): Language[] {
        if (!query) throw new Error("Query cannot be empty");

        let lowerQuery = query.toLowerCase();
        return this.languages.filter(({ slug, name }) => {
            return slug.toLowerCase().includes(lowerQuery) || name.toLowerCase().includes(lowerQuery);
        });
    }

    async buildCache(): Promise<void> {
        const filePath = VIDEO_CACHE_DIRECTORY;

        if (!fs.existsSync(filePath)) throw new Error("Cache directory does not exist");

        let findResults = await $`find ${filePath} -type f -name "*.mp4"`.text();
        let files = findResults.split("\n").filter(e => e.toLowerCase().includes("jesus")).filter(Boolean);

        this.videoCache = files
    }

    findVideoURLFromCache(language: Language): string | undefined {
        const normalize = (str: string) =>
            str.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(" ").filter(Boolean);

        let slugTerms = language.slug
            .toLowerCase()
            .replace(/[-,]/g, " ")
            .split(" ")
            .filter(Boolean);

        let nameTerms = language.name
            .toLowerCase()
            .replace(/[-,]/g, " ")
            .split(" ")
            .filter(Boolean);

        let searchTerms: string[] = Array.from(new Set([...slugTerms, ...nameTerms]));



        // Normalize filenames and match
        const matches: { file: string; score: number }[] = this.videoCache.map(file => {
            const filename = path.basename(file);
            const fileTerms = normalize(filename);

            // Count matching terms
            const matchCount = searchTerms.filter(term =>
                fileTerms.some(fileTerm => fileTerm.includes(term) || term.includes(fileTerm))
            ).length;

            return { file, score: matchCount };
        }).filter(result => result.score > 0);

        // Sort by score (most matches first)
        matches.sort((a, b) => b.score - a.score);

        if (matches.length > 0) {
            console.clear();
            console.log(`Found ${matches.length} matching videos for language "${language.name}":`);

            const result = createSelection([
                { text: "None. " }, ...matches.map(({ file, score }) => ({
                    text: file,
                    description: `Score: ${score}`,
                }), {
                    headerText: `Select Video for ${language.name}`,
                    perPage: 5,
                })
            ])
            if (result.selectedIndex == 0) {
                return undefined
            }
            if (!result.error && result.selectedIndex !== null) {
                return matches[result.selectedIndex - 1].file;
            } else {
                console.log("Error:", result.error);
            }
        } else {
            return undefined;
        }
    }

    async fetchLanguageDownloadURL(language: Language): Promise<string> {
        if (!this.languages.some(e => language.slug === e.slug)) {
            throw new Error(`Language "${language}" not found.`);
        }

        let response = await fetch(`https://www.jesusfilm.org/watch/jesus.html/${language.slug}.html`);
        let text = await response.text();

        // Extract the JSON from the <script id="__NEXT_DATA__" type="application/json"> tag
        const match = text.match(
            /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
        );
        fs.writeFileSync("dump.html", text, "utf8");

        if (match && match[1]) {
            const jsonData = JSON.parse(match[1]);

            let quality = ["highest", "high", "distroHigh", "sd", "distroLow", "low"]

            let qualities = jsonData.props.pageProps.content.variant.downloads.sort((a, b) => {
                let aQualityLevel = quality.indexOf(a.quality) ?? 0
                let bQualityLevel = quality.indexOf(b.quality) ?? 0

                return aQualityLevel - bQualityLevel
            })


            let url = qualities[0].url
            return url;
        } else {
            console.log(`https://www.jesusfilm.org/watch/jesus.html/${language.slug}.html`)
            console.log(response)
            fs.writeFileSync("dump.html", text, "utf8");


            throw new Error("Could not find the NEXT_DATA in the page.");
        }
    }

    async getVideosForLanguages(languages: Language[]): Promise<Video[]> {

        let videos: Video[] = [];
        let index = 0
        for await (const language of languages) {
            index++

            console.clear()
            console.log(`${banner}`);

            const barLength = 50
            const total = languages.length
            const percent = index / total
            const amountCompleated = barLength * percent
            const amountLeft = Math.max(barLength - amountCompleated, 0)


            console.log(`  [${index}/${languages.length}] [` + `█`.repeat(amountCompleated) + " ".repeat(amountLeft) + `]`)

            let videoFromCache = mpkLoader.findVideoURLFromCache(language);
            if (videoFromCache) {

                let localVideo: Video = {
                    isLocal: true,
                    localPath: videoFromCache,
                    language: language
                };

                videos.push(localVideo);

            } else {
                let url = await mpkLoader.fetchLanguageDownloadURL(language);
                

                let remoteVideo: Video = {
                    isLocal: false,
                    remoteURL: url,
                    language: language
                };

                videos.push(remoteVideo);
            }
        }

        return videos

    }
}

let mpkLoader = new MPKLoader();
await mpkLoader.init()


// Rendering
const reset = "\x1b[0m";
const bold = "\x1b[1m";
const cyan = "\x1b[36m";
const magenta = "\x1b[35m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const white = "\x1b[37m";
const dim = "\x1b[2m";

const banner = `

                            ${bold}MPK Loader${reset}
  A cool tool for loading ${cyan}${bold}Jesus Film Videos${reset} for the ${magenta}${bold}MPK project${reset}.
  ${dim}by ${bold}@Lukas1h                                           [ v0.1 ]${reset}\n`




// Main Application Loop

let languagesToLoad: {
    slug: string;
    name: string;
}[] = []

while (true) {

    console.clear();
    console.log(`${banner}`);
    console.log(`  ${bold}Languages Added: ${dim}[${languagesToLoad.map(e => e.slug).join(", ")}]${reset}`);
    console.log(``)


    let query: string | undefined = undefined;
    const prompt = await createPrompt("Language: ", { required: false });

    if (prompt.value && !prompt.error) {
        query = prompt.value.trim();
    } else {
        break
    }

    let languages = mpkLoader.getLanguagesForQuery(query);

    const result = createSelection([
        { text: "Cancel" },
        ...languages.map(({ slug, name }) => ({
            text: slug,
            description: name
        }))
    ], {
        headerText: 'Select Languages ',
        perPage: 5,
    })

    if (result.selectedIndex == 0) {
        // console.log("Cancelled selection.");
    } else if (!result.error && result.selectedIndex !== null) {
        // console.log("Selected language:", languages[result.selectedIndex - 1]);

        languagesToLoad.push(languages[result.selectedIndex - 1]);
    } else {
        console.log("Error:", result.error);
    }
}



let videos = await mpkLoader.getVideosForLanguages(languagesToLoad);

console.clear()
console.log(`${banner}`);
console.log(`  Found ${bold}${videos.filter(e => e.isLocal).length}${reset} local videos and ${bold}${videos.filter(e => !e.isLocal).length}${reset} remote videos.`)
console.log(`  ${bold}Ready to download:${reset}${dim} ${videos.filter(e => !e.isLocal).map(e => `${e.language.slug}`).join(", ")}${reset}?`)


