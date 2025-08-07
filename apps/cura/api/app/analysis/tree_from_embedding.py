from sklearn.cluster import KMeans
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from scipy.cluster.hierarchy import linkage, fcluster
import random

def tree_from_embedding(item_data_list):
    #item_data_list = [{
    #    "id": item.id,
    #    "name": item.name,
    #    "embedding": item.embedding
    #}, ... ]

    n_data = len(item_data_list)
    if n_data < 3:
        n_clusters = 1
        n_top_clusters = 1
    else:
        n_clusters = n_data // 10 + 3
        n_top_clusters = n_clusters // 10 + 3
                
    # K-means 클러스터링 수행
    kmeans = KMeans(n_clusters=n_clusters, random_state=42)
    clusters = kmeans.fit_predict(np.array([item["embedding"] for item in item_data_list]))
    
    # 클러스터 중심점 계산
    cluster_centers = kmeans.cluster_centers_
    
    # 각 클러스터의 기술들 그룹화
    cluster_techs = {}
    for i, cluster_id in enumerate(clusters):
        if cluster_id not in cluster_techs:
            cluster_techs[cluster_id] = []
        cluster_techs[cluster_id].append(item_data_list[i])
        
    # 클러스터 간 유사도 계산
    cluster_similarities = cosine_similarity(cluster_centers)
    
    # 계층적 클러스터링을 위한 거리 행렬 생성
    distance_matrix = 1 - cluster_similarities
    Z = linkage(distance_matrix, method='ward')
    
    # 3개의 최상위 그룹으로 분류
    top_clusters = fcluster(Z, n_top_clusters, criterion='maxclust')
    
    # 결과 트리 구조 생성
    tree = []
    
    # 최상위 그룹별로 클러스터 정리
    for top_group in range(1, n_top_clusters + 1):
        group_clusters = [i for i, x in enumerate(top_clusters) if x == top_group]
        
        group_node = {
            "name": f"Group {top_group}",
            "label": f"(",
            "value": [],
            "children": []
        }
        cluster_names = []
        cluster_values = []

        for cluster_id in group_clusters:
            if cluster_id in cluster_techs:
                cluster_node = {
                    "name": f"Cluster {cluster_id}",
                    "label": f"(",
                    "value": [],
                    "children": [],
                }
                names = []
                values = []
                for tech in cluster_techs[cluster_id]:
                    cluster_node["children"].append({
                        "name": tech["name"],
                        "label": tech["name"] if len(tech["name"]) < 10 else tech["name"][:10] + "...",
                        "value": tech["id"],
                    })
                    names.append(tech["name"])
                    values.append(tech["id"])
                cluster_node["label"] += ",".join(names)
                if len(cluster_node["label"]) > 10:
                    cluster_node["label"] = cluster_node["label"][:10] + "..."
                cluster_node["label"] += ")"
                random.shuffle(names)
                random.shuffle(values)

                cluster_node["value"] = values
                cluster_values.extend(values)

                cluster_names.append(names[0])
                group_node["children"].append(cluster_node)

        group_node["label"] += ",".join(cluster_names)        
        if len(group_node["label"]) > 10:
            group_node["label"] = group_node["label"][:10] + "..."
        group_node["label"] += ")"
        group_node["value"] = cluster_values
        tree.append(group_node)

    return tree
