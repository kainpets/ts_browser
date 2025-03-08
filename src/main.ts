class My_URL {
  scheme: string;

  constructor(url: string) {
    const [scheme, remainingUrl] = url.split("://", 2);

    if (scheme !== "http") {
      throw new Error("Only http scheme is supported");
    }

    this.scheme = scheme;
  }





}
