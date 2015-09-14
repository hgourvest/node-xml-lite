var assert = require('assert');
var request = require('request');
var path = require('path');

var xml = require(path.join(__dirname, '..', 'index.js'));
var filename = path.join(__dirname, 'test.xml');
var bomfilename = path.join(__dirname, 'bomtest.xml');

var bomFeedTests = function(root) {
	assert.equal(typeof root, "object");
	assert.equal(root.name, 'rss');
	var channels = root.childs.filter(function(current){
			if (typeof current === 'object' && current.name === 'channel') {
				return true;
			}

		return false;
	});

	assert.equal(channels.length, 1);
};

it("should be parse the fixture: test.xml", function() {
		var parsed = xml.parseFileSync(filename);
		assert.equal(parsed.name, 'xml')
		assert.equal(parsed.attrib.attr, 'value');
});

it("sould be parse local xml with BOM in it (async)", function(done) {
		var parsed = xml.parseFile(bomfilename, function(error, root) {
				bomFeedTests(root);
				done();
		});    
});

it("sould be parse local xml with BOM in it (sync)", function() {
		var root = xml.parseFileSync(bomfilename);    
		bomFeedTests(root);
});

it("should parse XML with BOM (parseString)", function(done) {
		this.timeout(5000);

		var testUrlWithBom = 'http://feeds.podtrac.com/kJVKNvGiQn6Q';

		var testParser = function(str) {
			try {
				var parsed = xml.parseString(str);    
				bomFeedTests(parsed);
				done();
			} catch(e) {
				console.log(
					'[ERR] Error on parsing the document!',
					e
				);
			}
		};

		request.get(testUrlWithBom, function(error, response, body) {
				if (!error && response.statusCode === 200) {
					testParser(body);
				} else if (error) {
					console.log({
							'responseCode': response.statusCode,
							'error': error
							});
					}
				});
});
