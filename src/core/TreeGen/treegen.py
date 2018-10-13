import requests
import json
import pdb
import time

url_string = "https://api.hooktheory.com/v1/trends/nodes?cp=1"
response = requests.get("https://api.hooktheory.com/v1/trends/nodes?cp=1", headers={'Authorization': "Bearer 0449bff346d2609ac119bfb7d290e9bb"})
hook_result = json.loads(response.text)
json_result = {}
chord_ID = "1"
json_result[1] = {"prob": [], "child": []}
d_limit = 5


def build_json(current, depth):
# if depth is d_limit:
# return

    global url_string
    global chord_ID
    global hook_result
    global response
    index = 0
    url_string = url_string.split("=")[0] + "=" + chord_ID
    response = requests.get(url_string, headers={'Authorization': "Bearer 0449bff346d2609ac119bfb7d290e9bb"})
    hook_result = json.loads(response.text)
    time.sleep(1.2)
    print("Called API Depth " + str(depth))

    for obj in hook_result[:5]:
        probability = obj["probability"]
        chord_ID = obj["chord_ID"].encode("ascii")
        current["prob"].append(probability)
        current["child"].append({chord_ID: {}})

        if chord_ID is '1' or depth is d_limit:
            return


        current["child"][index][chord_ID] = {"prob": [], "child": []}
        build_json(current["child"][index][chord_ID], depth+1)
        index += 1




current = json_result[1]
build_json(current, 0)
print json_result
with open('chord_tree.json', 'w') as outfile:
    json.dump(json_result, outfile)