import net from "net"
import tls from "tls"
import fs from "fs"

class My_URL {
  host: string = ""
  path: string
  scheme: string = "http"
  port: number = 80

  constructor(url: string) {
    try {
      // Parse scheme (http/https/file/empty string)
      if (url === "") {
        this.scheme = "file"
        this.path = "/Users/pawelstepniak/Desktop/programming.nosync/test.txt"
        return
      } else if (url.startsWith("data:text/html,")) {
        this.scheme = "data"
        this.path = url.substring(15)
        return
      } else if (url.startsWith("file:///")) {
        this.scheme = "file"
        this.path = url.substring(8)
        return
      } else if (url.includes("://")) {
        const [scheme, remainder] = url.split("://", 2)
        this.scheme = scheme.toLowerCase()
        url = remainder

        if (this.scheme !== "http" && this.scheme !== "https") {
          throw new Error(`Unsupported scheme: ${this.scheme}`)
        }
      }

      // The following code should only run for HTTP/HTTPS URLs
      // Parse host and path
      if (!url.includes("/")) {
        url += "/"
      }
      const parts = url.split("/")
      this.host = parts[0]
      this.path = "/" + parts.slice(1).join("/")

      // Parse port if specified in host
      if (this.host.includes(":")) {
        const [hostName, portStr] = this.host.split(":", 2)
        this.host = hostName
        this.port = parseInt(portStr, 10)
      } else {
        // Default ports
        if (this.scheme === "https") {
          this.port = 443
        } else {
          this.port = 80
        }
      }
    } catch (error) {
      console.error("Malformed URL found, falling back to the WBE home page.")
      console.error(`  URL was: ${url}`)
      this.scheme = "https"
      this.host = "browser.engineering"
      this.path = "/"
      this.port = 443
    }
  }

  async request(): Promise<string> {
    if (this.scheme === "file") {
      try {
        const data = await fs.promises.readFile(this.path, "utf-8")
        return data
      } catch (e) {
        console.error(`Error reading file ${this.path}:`, e)
        return `Error: Could not read file ${this.path}`
      }
    } else if (this.scheme === "data") {
      return this.path  
    }

    return new Promise((resolve, reject) => {
      let socket = new net.Socket()

      socket.connect(
        {
          host: this.host,
          port: this.port,
        },
        async () => {
          try {
            let finalSocket: net.Socket = socket

            // Handle HTTPS
            if (this.scheme === "https") {
              finalSocket = tls.connect({
                socket: socket,
                host: this.host,
                servername: this.host,
                rejectUnauthorized: true,
              })

              // Wait for the TLS handshake to complete
              await new Promise<void>((resolveHandshake, rejectHandshake) => {
                ; (finalSocket as tls.TLSSocket).once(
                  "secureConnect",
                  resolveHandshake
                )
                  ; (finalSocket as tls.TLSSocket).once("error", rejectHandshake)
              })
            }

            // Send the request
            const request =
              `GET ${this.path} HTTP/1.1\r\n` +
              `Host: ${this.host}\r\n` +
              `User-Agent: TS Web Browser\r\n` +
              `Connection: close\r\n\r\n`

            finalSocket.write(request, "utf-8")

            // Read the response
            let responseData = ""
            finalSocket.on("data", (data) => {
              responseData += data.toString("utf-8")
            })

            finalSocket.on("end", () => {
              // Parse the response
              const lines = responseData.split("\r\n")
              const statusLine = lines[0]
              const [version, status, ...explanationParts] =
                statusLine.split(" ")
              const explanation = explanationParts.join(" ")

              // Parse headers
              const responseHeaders: { [key: string]: string } = {}
              let i = 1
              while (i < lines.length) {
                const line = lines[i]
                if (line === "") break

                const [header, value] = line.split(":", 2)
                if (header && value) {
                  responseHeaders[header.toLowerCase()] = value.trim()
                }
                i++
              }

              // Check for unsupported encodings
              if ("transfer-encoding" in responseHeaders) {
                reject(new Error("Unexpected transfer-encoding header"))
                return
              }

              if ("content-encoding" in responseHeaders) {
                reject(new Error("Unexpected content-encoding header"))
                return
              }

              // Extract content
              const content = lines.slice(lines.indexOf("") + 1).join("\r\n")

              finalSocket.destroy()
              resolve(content)
            })

            finalSocket.on("error", (err) => {
              reject(err)
            })
          } catch (err) {
            reject(err)
          }
        }
      )

      socket.on("error", (err) => {
        reject(err)
      })
    })
  }

  show(body: string) {
    let inTag = false
    for (const c of body) {
      if (c === "<") {
        inTag = true
      } else if (c === ">") {
        inTag = false
      } else if (!inTag) {
        process.stdout.write(c)
      }
    }
    process.stdout.write("\n")
  }
}

async function load(url: My_URL) {
  const body = await url.request()
  url.show(body)
}

async function main() {
  try {
    let url
    if (process.argv.length < 3 || process.argv[2] === "") {
      // No URL provided or empty URL - create URL object directly
      url = new My_URL("")
    } else {
      url = new My_URL(process.argv[2])
    }
    await load(url)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}
