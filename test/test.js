var assert = require('assert');
var request = require('request');

var xml = require('../index.js');
var filename = __dirname + '/test.xml';

it("should be parse the fixture: test.xml", function() {
   var parsed = xml.parseFileSync(filename);
   assert.equal(parsed.name, 'xml')
   assert.equal(parsed.attrib.attr, 'value');
   assert.equal(parsed.childs.length, 7);

   // TODO write the other tests
}); 

it("should parse XML with BOM", function(done) {
    this.timeout(5000);

    var testUrlWithBom = 'http://feeds.podtrac.com/kJVKNvGiQn6Q';

    var testParser = function(str) {
        try {
            var parsed = xml.parseString(str);    
            assert.equal(parsed.name, 'rss');
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
