from typing import List, Dict, Any
from sqlalchemy.orm import Session, load_only, defer, selectinload
from sqlalchemy import and_, or_, func, desc, asc
from models import ImageData, DirectoryData, SubDirectoryData
from db import Image, ImageGroup, Group, Keyword, ImageKeyword, Path



def get_directory(dir_path: str, db: Session) -> DirectoryData:

    #orphan_images = db.query(Image.id).filter(~Image.id.in_(db.query(Path.image_id))).all()
    #for image in orphan_images:
    #    path = Path(
    #        path=dir_path + image.id,
    #        image_id=image.id,
    #    )
    #    db.add(path)
    #db.commit()


    images_list = []
    sub_dirs_list = []

    path_list = db.query(Path).filter(Path.path.like(dir_path + '%')).all()

    thumbnail_image_counts = {}
    thumbnail_image_ids_by_sub_dir = {}
    directory_image_ids = set()
    sub_dir_paths = set()
    depth = len(dir_path.split('/'))
    for path in path_list:
        path_arr = path.path.split('/')
        if len(path_arr) > depth:
            sub_dir_path = '/'.join(path_arr[:depth])+'/'
            sub_dir_paths.add(sub_dir_path)
            if sub_dir_path not in thumbnail_image_counts:
                thumbnail_image_counts[sub_dir_path] = 0
            thumbnail_image_counts[sub_dir_path] += 1
            if sub_dir_path not in thumbnail_image_ids_by_sub_dir:
                thumbnail_image_ids_by_sub_dir[sub_dir_path] = []
            if thumbnail_image_counts[sub_dir_path] < 4:
                thumbnail_image_ids_by_sub_dir[sub_dir_path].append(path.image_id)
        elif len(path_arr) == depth:
            directory_image_ids.add(path.image_id)
        else:
            continue
    
    thumbnail_image_ids_list = []
    for image_ids in thumbnail_image_ids_by_sub_dir.values():
        thumbnail_image_ids_list.extend(image_ids)
    image_urls = db.query(Image.id, Image.url).filter(Image.id.in_(thumbnail_image_ids_list)).all()
    images_map = {image.id: image.url for image in image_urls}

    for sub_dir_path in sub_dir_paths:
        n_images = thumbnail_image_counts[sub_dir_path]
        thumbnail_urls = []
        for image_id in thumbnail_image_ids_by_sub_dir[sub_dir_path]:
            thumbnail_urls.append(images_map[image_id])
        sub_dirs_list.append(SubDirectoryData(path=sub_dir_path, n_images=n_images, thumbnail_images_urls=thumbnail_urls))

    directory_images = db.query(Image).filter(Image.id.in_(directory_image_ids)).order_by(Image.created_at.desc()).options(load_only(
                            Image.id,
                            Image.title,
                            Image.positive_prompt,
                            Image.negative_prompt,
                            Image.model,
                            Image.steps,
                            Image.cfg,
                            Image.height,
                            Image.width,
                            Image.seed,
                            Image.url,
                        ),
                        defer(Image.embedding)).all()

    for image in directory_images:
        images_list.append(ImageData(id=image.id, 
                            title=image.title, 
                            positive_prompt=image.positive_prompt, 
                            negative_prompt=image.negative_prompt, 
                            model=image.model, 
                            steps=image.steps, 
                            cfg=image.cfg, 
                            height=image.height, 
                            width=image.width, 
                            seed=image.seed, 
                            url=image.url, 
                            keywords=[]))

    return DirectoryData(
        path=dir_path,
        sub_dirs=sub_dirs_list,
        images=images_list,
    )


def delete_directory(dir_path: str, db: Session) -> str:
    db.query(Path).filter(Path.path.like(dir_path + '%')).delete()

    #delete orphan images
    orphan_images = db.query(Image.id).filter(~Image.id.in_(db.query(Path.image_id))).all()
    for image in orphan_images:
        db.delete(image)
    db.commit()
    return f"{dir_path} 디렉토리가 삭제되었습니다."


def delete_path_batch(path_list: List[str], db: Session) -> str:
    
    db.query(Path).filter(Path.path.in_(path_list)).delete()

    #delete orphan images
    orphan_images = db.query(Image.id).filter(~Image.id.in_(db.query(Path.image_id))).all()
    for image in orphan_images:
        db.query(Image).filter(Image.id == image.id).delete()
    db.commit()
    return f"{len(path_list)}개의 경로가 삭제되었습니다."


def set_image_directory_batch(dir_path: str, image_ids: List[str], db: Session) -> str:
    for image_id in image_ids:
        new_path = dir_path + image_id
        if db.query(Path).filter(Path.path == new_path).first():
            pass
        else:
            path = Path(path=new_path, image_id=image_id,)
            db.add(path)
    db.commit()
    return f"{len(image_ids)}개의 이미지가 '{dir_path}' 디렉토리에 설정되었습니다."


def move_path_batch(path_change_dict: Dict[str, str], db: Session) -> str:
    for prev_path, new_path in path_change_dict.items():
        if db.query(Path).filter(Path.path == new_path).first():
            db.query(Path).filter(Path.path == prev_path).delete()
        else:
            db.query(Path).filter(Path.path == prev_path).update({Path.path: new_path})
    db.commit()
    return f"{len(path_change_dict)}개의 경로가 이동되었습니다."

def edit_dir_path(prev_path: str, new_path: str, db: Session) -> str:
    paths = db.query(Path).filter(Path.path.like(prev_path + '%')).all()
    for path in paths:
        path.path = new_path + path.path.replace(prev_path, '')
    db.commit()    
    return f"{prev_path}가 {new_path}로 변경되었습니다."