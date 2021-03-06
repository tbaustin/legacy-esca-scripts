import { exec } from 'child-process-promise'
import renderer from 'react-test-renderer'
import React from 'react'
import { copy, readFile } from 'fs-extra'
import puppeteer from 'puppeteer'
import getPort from 'get-port'
import Server from 'static-server'
import { join } from 'path'
import { version } from '../package.json'

jest.setTimeout(60 * 1000)

describe(`CLI help`, () => {
	it(`Should return something`, async () => {
		let res = await exec(`babel-node dist version`)
		expect(res.stdout).toEqual(`${version}\n`)
		expect(res.stderr).toEqual(``)
	})
})
describe(`Build`, () => {
	beforeAll(async () => {
		let res = await exec(`babel-node dist build --src src-test --dist dist-test`)
		expect(res.stderr).toEqual(``)
	})
	it(`Should build a valid React component`, async () => {
		let TestComponent = await import('../dist-test/component')
		TestComponent = TestComponent.default
		let component = renderer.create(
			<TestComponent />
		)
		let tree = component.toJSON()
		expect(tree).toMatchSnapshot()
	})
	it(`Should build a valid JavaScript module`, async () => {
		let TestModule = await import('../dist-test/module')
		TestModule = TestModule.default
		expect(TestModule()).toEqual(19)
	})
	it(`Should exit on error`, async () => {
		let res = await exec(`babel-node dist build --src asdf --dist dist-asdf`)
		expect(res.stderr).toBeTruthy()
	})
	afterAll(async () => {
		await exec(`rm -rf dist-test`)
	})
})
describe(`Bundle`, () => {
	let server
	let browser
	beforeAll(async () => {
		server = new Server({
			rootPath: `dist-bundle-test`,
			port: await getPort(),
		})
		server.start()
		browser = await puppeteer.launch({
			headless: true,
			args: ['--no-sandbox'],
		})
		let res = await exec(`babel-node dist bundle --src src-test/index.html --dist dist-bundle-test`)
		expect(res.stderr).toEqual(``)
	})
	it(`Should build a valid React component`, async () => {
		let page = await browser.newPage()
		await page.goto(`http://localhost:${server.port}`)
		await page.waitForSelector(`.test`)
		const content = await page.$eval(`.test`, e => e.textContent)
		expect(content).toEqual(`Testing.`)

	})
	it(`Should exit on error`, async () => {
		let res = await exec(`babel-node dist bundle --src src-asdf/index.html --dist dist-asdf`)
		expect(res.stderr).toBeTruthy()
	})
	afterAll(async () => {
		server.stop()
		await Promise.all([
			browser.close(),
			exec(`rm -rf dist-bundle-test`),
			exec(`rm -rf dist-asdf`),
		])
	})
})
describe(`Rename`, () => {
	beforeAll(async () => {
		await Promise.all([
			copy(`./package.json`, `./dist-test/package.json`),
			copy(`./src-test/serverless.yml`, `./dist-test/serverless.yml`),
		])
		let res = await exec(`cd dist-test && babel-node ../dist rename`)
		expect(res.stderr).toEqual(``)
	})
	it(`Should rename a package.json file`, async () => {
		let pkg = await import(`../dist-test/package.json`)
		expect(pkg.name).toEqual(`dist-test`)
	})
	it(`Should rename a serverless.yml file`, async () => {
		let config = await readFile(`./dist-test/serverless.yml`)
		config = config.toString()
		config = config.split(`\n`)
		expect(config[0]).toEqual(`service: dist-test`)
	})
	afterAll(async () => {
		await exec(`rm -rf dist-test`)
	})
})
describe(`Run`, () => {
	it(`Should run a file with ES6`, async () => {
		let res = await exec(`babel-node dist run --file src-test/run.js`)
		expect(res.stderr).toEqual(``)
		res = res.stdout.trim()
		res = res.split(`\n`)
		res = res.pop()
		expect(res).toEqual(`19`)
	})
	it(`Should exit on error`, async () => {
		let res = await exec(`babel-node dist run --file src-asdf/run.js`)
		expect(res.stderr).toBeTruthy()
	})
	afterAll(async () => {
		await exec(`rm -rf dist-test`)
	})
})
