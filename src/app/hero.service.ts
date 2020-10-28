import { Injectable, EventEmitter } from '@angular/core';
import { Observable, of, from } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, tap, concatAll } from 'rxjs/operators';
import PouchDB from 'pouchdb';
import pouchDBFind from 'pouchdb-find';


import { Hero } from './hero';
//import { HEROES } from './mock-heroes';
import { MessageService } from './message.service';

PouchDB.plugin(pouchDBFind);

@Injectable({
  providedIn: 'root'
})
export class HeroService {

  private isInstantiated: boolean;
  private db: any;
  

  getHeroes(): Observable<Hero[]> {
    // TODO: send the message _after_ fetching the heroes
    this.messageService.add('HeroService: fetched heroes');
    // return of(HEROES);    
    return from(this.db.find({
      selector: { type:"hero" }
    }).then(result => {      
      let heroes: Array<Hero> = [];
      result.docs.forEach(doc=> {       
        doc._id != 'seq'?heroes.push({ "name": doc.name, "_id": doc._id } as Hero):null;
      });
     
      return heroes;

    }, error => {
      console.error(error);
    })).pipe(map(result => <Hero[]>result));   
  }


  getId() {

    return this.db.get('seq').then(doc => {
      doc.value++;
      this.db.put(doc);
      return doc;
    }, error => {
      if (error.status === 404) {
        this.db.put({ "_id": "seq", "value": 1 });
        return this.getId();

      } else {
        return new Promise((resolve, reject) => {
          reject(error);
        });
      }
    })

  }
  getHero(_id: string): Observable<Hero> {
    // TODO: send the message _after_ fetching the hero
    this.messageService.add(`HeroService: fetched hero id=${_id}`);
    return from(this.db.get(_id)).pipe(
      map(doc => <Hero>doc),
      tap(_ => this.log(`fetched hero id=${_id}`)),
      catchError(this.handleError<Hero>(`getHero id=${_id}`))
    );
    //return of(HEROES.find(hero => hero.id === id));
  }
  /** PUT: update the hero */
  updateHero(hero: Hero): Observable<Hero> {
    return from(this.db.put(hero)).pipe(
      map(doc => <Hero>doc),
      tap(_ => this.log(`updated hero id=${hero._id}`)),
      catchError(this.handleError<any>('updateHero'))
    );

  }
  /** POST: add a new hero to the db */
  addHero(hero: Hero): Observable<Hero> {
    //return this.http.post<Hero>(this.heroesUrl, hero, this.httpOptions).pipe(
    //  tap((newHero: Hero) => this.log(`added hero w/ id=${newHero.id}`)),
    //  catchError(this.handleError<Hero>('addHero'))
    //);
    
    return from(this.getId().then((doc) => {
      
      hero._id = doc.value.toString();
      hero.type="hero";
      this.db.put(hero);
      return hero;
    })).pipe(map(hero => <Hero>hero));


  }
  /** DELETE: delete the hero from db */
  deleteHero(hero: Hero | string): Observable<Hero> {
    const id = typeof hero === 'string' ? hero : hero._id;
    var self = this;

    return from(this.db.get(id).then(function (doc) {
      self.log(`deleted doc rev=${doc._rev}`);
      return self.db.remove(doc);

    })).pipe(
      map(doc => <Hero>doc),
      tap(_ => this.log(`deleted hero id=${id}`)),
      catchError(this.handleError<any>('deleteHero'))
    );

  }
  /* GET heroes whose name contains search term */
  searchHeroes(term: string): Observable<Hero[]> {
    if (!term.trim()) {
      // if not search term, return empty hero array.
      return of([]);
    }
  
    return from(     
      this.db.find({
        selector: { type:"hero", name: { $regex: RegExp(term, "i") } }
      }).then(result => {
        if (result.warning) {
          console.warn(result.warning);
        }

        let heroes: Array<Hero> = [];
        result.docs.forEach(doc => {
          doc._id != 'seq'?heroes.push({ "name": doc.name, "_id": doc._id } as Hero):null;
        });
        
        return heroes;
      })
    ).pipe(
      map(result => <Hero[]>result),
      tap(x => x.length ?
        this.log(`found heroes matching "${term}"`) :
        this.log(`no heroes matching "${term}"`)),
      catchError(this.handleError<Hero[]>('searchHeroes', []))
    );

    //return this.http.get<Hero[]>(`${this.heroesUrl}/?name=${term}`).pipe(
    //  tap(x => x.length ?
    //    this.log(`found heroes matching "${term}"`) :
    //    this.log(`no heroes matching "${term}"`)),
    // catchError(this.handleError<Hero[]>('searchHeroes', []))
    //);
  }
  _ensureIndexOfType() {
    return this.db.createIndex({
      index: {
        fields: ["type"]
      }
    });
  }
  _ensureIndexOfTypeAndName() {
    return this.db.createIndex({
      index: {
        fields: ["type","name"]
      }
    });
  }
  ensureIndexes() {
    return Promise.all([
      this._ensureIndexOfType(),
      this._ensureIndexOfTypeAndName()     
    ]);
  }


 
  private log(message: string) {
    this.messageService.add(`HeroService: ${message}`);
  }
  /**
 * Handle Http operation that failed.
 * Let the app continue.
 * @param operation - name of the operation that failed
 * @param result - optional value to return as the observable result
 */
  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {

      // TODO: send the error to remote logging infrastructure
      console.error(error); // log to console instead

      // TODO: better job of transforming error for user consumption
      this.log(`${operation} failed: ${error.message}`);

      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  constructor(
    private http: HttpClient,
    private messageService: MessageService) {
    if (!this.isInstantiated) {
      this.db = new PouchDB("heroes");      
      this.isInstantiated = true;
      this.ensureIndexes();
    }
  }
}
