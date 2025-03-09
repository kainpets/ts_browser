import net from "net";

class My_URL {
  host: string;
  path: string;

  constructor(url: string) {
    if (!url.includes("/")) {
      url += "/"
    }
    const [host, remainingPath] = url.split("://", 2);

    this.host = host;
    this.path = "/" + (remainingPath || "");
  }

  async request(): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let responseData = '';

      socket.connect({
        host: this.host,
        port: 80
      }, () => {
        const request = `GET ${this.path} HTTP/1.0\r\n` +
          `Host: ${this.host}\r\n\r\n`;

        socket.write(request, 'utf-8');
      });

      socket.on('data', (data) => {
        responseData += data.toString('utf-8');
      });

      socket.on('end', () => {
        const lines = responseData.split('\r\n');

        const [version, status, explanation] = lines[0].split(' ', 3);

        const responseHeaders: { [key: string]: string } = {};

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i];

          if (line === '') break;

          const [header, value] = line.split(':', 2);

          if (header && value) {
            responseHeaders[header.toLowerCase()] = value.trim();
          }
        }

        if ('transfer-encoding' in responseHeaders) {
          reject(new Error('Unexpected transfer-encoding header'));
          return;
        }

        if ('content-encoding' in responseHeaders) {
          reject(new Error('Unexpected content-encoding header'));
          return;
        }

        const content = lines.slice(lines.indexOf('') + 1).join('\r\n');

        socket.destroy();
        resolve(content);
      });

      socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  async load(url: My_URL) {
    try {
      const body = await url.request();
      this.show(body);
    } catch (error) {
      console.error('Error loading URL:', error);
    }
  }

  show(body: string) {
    let inTag = false;
    for (const c of body) {
      if (c === '<') {
        inTag = true;
      } else if (c === '>') {
        inTag = false;
      } else if (!inTag) {
        process.stdout.write(c);
      }
    }
  }
}

async function main() {
  if (process.argv.length < 3) {
    console.error('Please provide a URL');
    process.exit(1);
  }

  const url = new My_URL(process.argv[2]);
  await url.load(url);
}

if (require.main === module) {
  main().catch(console.error);
}
