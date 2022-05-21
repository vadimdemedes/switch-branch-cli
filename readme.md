# switch-branch-cli

> Switch git branches by their pull request title

![](demo.gif)

## Install

```console
npm install --global switch-branch-cli
```

## Usage

```
$ switch-branch --help

  Switch git branches by their pull request title

  Usage
    $ switch-branch

```

## FAQ

### Why does it ask for my GitHub personal access token?

This CLI needs it to fetch your pull requests for the current git repository. Your personal access token is stored locally and you will be asked for it only once (unless you revoke it or token expires).
