import { $ } from "bun";

interface ComponentOptions {
    alignmentVertical: 'leading' | 'trailing' | 'center',
    alignmentHorizontal: 'leading' | 'trailing' | 'center',
    padding: number,
    margin: number
    position: { x?: number, y?: number }
}

class Component {


    content: string
    options: ComponentOptions

    constructor(
        content: string = "",
        options: Partial<ComponentOptions> = {}
    ) {
        this.content = content;
        this.options = {
            alignmentHorizontal: options.alignmentHorizontal ?? 'center',
            alignmentVertical: options.alignmentVertical ?? 'center',
            padding: options.padding ?? 0,
            margin: options.margin ?? 0,
            position: options.position ?? {}
        };
    }
}


const reset = "\x1b[0m";
const bold = "\x1b[1m";
const cyan = "\x1b[36m";
const magenta = "\x1b[35m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const white = "\x1b[37m";
const dim = "\x1b[2m";


let title = new Component(
    `${bold}MPK Loader${reset}`,
    {
        alignmentHorizontal: 'center',
        position: { y: 2 }
    }
)

let subtitle = new Component(
    `${dim}A cool tool for loading ${bold}Jesus Film Videos${dim} for the ${bold}MPK project.${reset}`,
    {
        alignmentHorizontal: 'center',
        position: { y: 3 }
    }
)

let center = new Component(
    `|
|
|
|`,
    {
        alignmentHorizontal: 'center',
        position: { y: 6 }
    }
)

// let text = new Component(
//     `This is some text`,
//     {
//         alignmentHorizontal: 'trailing',
//         alignmentVertical: 'trailing',
//         position: { y: 4 },
//         padding: 2
//     }
// )



let components: Component[] = [title, subtitle, center]


const ansiRegex = /\x1b\[[0-9;]*m/g;
function drawStringToBuffer(buffer: string[][], str: string, col: number, row: number) {
    let _col = Math.floor(col)
    let _row = Math.floor(row)
    let lines = str.split('\n')


    for (let k = 0; k < lines.length; k++) {
        let line = lines[k];
        let visibleCol = 0;
        let i = 0;

        while (i < line.length) {
            // Check for ANSI escape code at current position
            const ansiMatch = line.slice(i).match(ansiRegex);
            if (ansiMatch && ansiMatch.index === 0) {
                // Skip over the escape code
                i += ansiMatch[0].length;
                continue;
            }

            if (
                _row + k >= 0 &&
                _row + k < buffer.length &&
                _col + visibleCol >= 0 &&
                _col + visibleCol < buffer[_row + k].length
            ) {
                buffer[_row + k][_col + visibleCol] = reset + line[i] + reset
            }
            i++;
            visibleCol++;
        }
    }
}

const { columns, rows } = { columns: 96, rows: 12 };



while (true) {
    let buffer: string[][] = Array.from({ length: rows }, () =>
        Array.from({ length: columns }, () => ' ')
    );

    for (const component of components) {

        let string = component.content.trim()
        let lines = string.split("\n")

        let height = lines.length;
        let width = Math.max(
            ...lines.map(line => line.replace(ansiRegex, '').length)
        );

        let x: number = 0
        let y: number = 0

        if (component.options.position.x) {
            x = component.options.position.x
        } else {
            switch (component.options.alignmentHorizontal) {
                case 'center':
                    x = (columns / 2) - (width / 2)
                    break
                case 'leading':
                    x = 0 + component.options.padding
                    break
                case 'trailing':
                    x = columns - width - component.options.padding
                    break
                default:
                    throw new Error("Not implimented")
            }
        }

        if (component.options.position.y) {
            y = component.options.position.y
        } else {
            switch (component.options.alignmentVertical) {
                case 'center':
                    y = (columns / 2) - (height / 2)
                    break;
                case 'leading':
                    y = 0 + (component.options.padding / 2)
                    break
                case 'trailing':
                    y = rows - height - (component.options.padding / 2)
                    break
                default:
                    throw new Error("Not implimented")
            }
        }


        // Example usage: draw "Hello" at row 2, column 5

        // let x = (columns / 2) - (string.length / 2)
        // let y = (rows / 2) - (string.split('\n').length / 2)

        drawStringToBuffer(buffer, string, x, y);
    }







    console.clear();
    process.stdout.write(buffer.map(e => e.join('')).join('\n'))
    await $`sleep 1`
}


