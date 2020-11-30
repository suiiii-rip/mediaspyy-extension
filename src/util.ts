export function s(o: any): string {
    return JSON.stringify(o);
}

export class Defer<T> {

    static create<T>(): Defer<T> {
        let resolve: (t: T) => void;
        let reject: (err: any) => void;
        const promise = new Promise<T>((res, rej) => {
            resolve = res;
            reject = rej;
        });

        return new Defer<T>(promise, resolve, reject);
    }

    public readonly promise: Promise<T>
    private readonly res: (t: T) => void
    private readonly rej: (err: any) => void

    private constructor(promise: Promise<T>,
               resolve: (t: T) => void,
               reject: (err: any) => void) {

                   this.promise = promise;
                   this.res = resolve;
                   this.rej = reject;
               }

    public resolve(t: T): Promise<T> {
        this.res(t);
        return this.promise;
    }

    public reject(err: any): Promise<T> {
        this.rej(err);
        return this.promise;
    }
}
