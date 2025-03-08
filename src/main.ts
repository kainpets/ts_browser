import * as net from 'net';

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

  request() {
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
        throw new Error('Unexpected transfer-encoding header');
      }

      if ('content-encoding' in responseHeaders) {
        throw new Error('Unexpected content-encoding header');
      }

      const content = lines.slice(lines.indexOf('') + 1).join('\r\n');

      socket.destroy();

      return content;
    });

    socket.on('error', (err) => {
      console.error('Socket error:', err);
    });
  }
}
