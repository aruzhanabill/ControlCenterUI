First, install a recent version of [Node.js](https://nodejs.org/).

We use bun as the package manager and runtime. See https://bun.sh for
installation instructions.

Next, install the dependencies:

```sh
bun install
```

To run the dev server, which has hot reloading:

```sh
bun dev
```

During actual operation, build the production bundle:

```sh
bun build
```

Then, use the following command to serve the bundle:

```sh
bun preview --host
```
When ready to publish a new release, create and push a version tag:
```sh
git tag v'tag_number' 
git push origin v'tag_number'
```
This will trigger the CI workflow to build and publish the release automatically. 
