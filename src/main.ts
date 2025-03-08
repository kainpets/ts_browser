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

  }
}
